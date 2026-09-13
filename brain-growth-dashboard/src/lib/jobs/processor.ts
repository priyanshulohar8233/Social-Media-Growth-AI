import { prisma } from "@/lib/db";
import { aiGenerate } from "@/lib/ai/gateway";
import { mockImage, mockVideo } from "@/lib/providers/mock";
import { logger } from "@/lib/logger";

/**
 * Background job processor — drains the GenerationJob queue.
 *
 * - QUEUED jobs are claimed (RUNNING) and executed.
 * - Real text generation goes through the model router (AiUsage recorded).
 * - Image/video go through the dev adapters until real ones are configured.
 * - Retry policy: up to MAX_ATTEMPTS, backoff between attempts, never infinite.
 * - Stale RUNNING jobs (server died mid-run) are reclaimed and retried.
 *
 * Used by the generation route (single job, near-sync) and by the cron/worker
 * endpoint POST /api/jobs/process (drain entire queue, non-blocking).
 */

const MAX_ATTEMPTS = 3;
const STALE_TIMEOUT_MS = 5 * 60 * 1000;

type GenerationJobKind = "IMAGE" | "VIDEO" | "TEXT" | "AWARE" | "ANALYZE";

async function executeJob(jobId: string, opts?: { userId?: string }) {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId }, include: { company: { select: { id: true } } } });
  if (!job || !job.company) {
    logger.warn("processGenerationJobs: job or company not found", { jobId });
    return;
  }

  const kind = (job.kind || "TEXT").toUpperCase() as GenerationJobKind;

  await prisma.generationJob.update({ where: { id: job.id }, data: { status: "RUNNING", attempts: { increment: 1 }, error: null } });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      let output: string;
      let assetUrl: string | null = null;
      let cost: number | null = null;
      let tokensUsed: number | null = null;

      if (kind === "IMAGE") {
        const img = await mockImage.generate({ prompt: job.prompt || "", companyId: job.companyId });
        output = JSON.stringify({ url: img.url, model: img.modelId });
        assetUrl = img.url;
      } else if (kind === "VIDEO") {
        const vid = await mockVideo.generate({ prompt: job.prompt || "", companyId: job.companyId });
        output = JSON.stringify({ url: vid.url, note: vid.note, model: vid.modelId });
        assetUrl = vid.url;
      } else {
        const res = await aiGenerate({
          companyId: job.companyId,
          userId: opts?.userId || null,
          capability: kind === "AWARE" || kind === "ANALYZE" ? "reasoning" : "writing",
          task: `generation:${kind.toLowerCase()}`,
          agent: "job-runner",
          prompt: job.prompt || "",
          jsonMode: kind === "AWARE",
        });
        output = res.text;
        cost = res.cost;
        tokensUsed = res.tokensUsed;
      }

      await prisma.generationJob.update({ where: { id: job.id }, data: { status: "COMPLETED", output, cost, tokensUsed, error: null, updatedAt: new Date() } });

      if (assetUrl) {
        await prisma.generationAsset.create({
          data: { companyId: job.companyId, jobId: job.id, contentId: (safeJson(job.input)?.contentId as string | undefined) ?? null, url: assetUrl, type: kind.toLowerCase(), meta: JSON.stringify({ modelId: job.modelId }) },
        });
      }
      logger.info("generation job completed", { jobId: job.id, kind, attempt, cost });
      return;
    } catch (e: unknown) {
      const err = e as Error;
      logger.error("generation job attempt failed", { jobId: job.id, attempt, maxAttempts: MAX_ATTEMPTS, ...logger.errorMeta(err) });
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 1500));
      } else {
        await prisma.generationJob.update({ where: { id: job.id }, data: { status: "FAILED", error: err.message, updatedAt: new Date() } });
        return;
      }
    }
  }
}

function safeJson(input: string | null): Record<string, unknown> | null {
  if (!input) return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

export async function processGenerationJobs(opts?: { batch?: number; ids?: string[]; userId?: string }): Promise<{ processed: number; completed: number; failed: number }> {
  const batch = opts?.batch ?? 5;
  const counts = { processed: 0, completed: 0, failed: 0 };

  let jobs;
  if (opts?.ids?.length) {
    jobs = await prisma.generationJob.findMany({ where: { id: { in: opts.ids }, status: { in: ["QUEUED", "RUNNING"] } }, take: batch });
  } else {
    // Reclaim stale RUNNING jobs (process crashed mid-run).
    const staleBefore = new Date(Date.now() - STALE_TIMEOUT_MS);
    const stale = await prisma.generationJob.findMany({
      where: { status: "RUNNING", updatedAt: { lt: staleBefore } },
      take: batch,
    });
    for (const s of stale) {
      await prisma.generationJob.update({ where: { id: s.id }, data: { status: "QUEUED", updatedAt: new Date() } });
    }
    jobs = await prisma.generationJob.findMany({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" }, take: batch });
  }

  for (const job of jobs) {
    const before = await prisma.generationJob.findUnique({ where: { id: job.id } });
    const wasFailed = before?.status === "FAILED";
    counts.processed++;
    await executeJob(job.id, opts);
    const after = await prisma.generationJob.findUnique({ where: { id: job.id } });
    if (after?.status === "COMPLETED") counts.completed++;
    else if (after?.status === "FAILED") counts.failed++;
    else if (wasFailed) counts.failed++;
  }

  return counts;
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { resolveModel } from "@/lib/models/registry";
import { processGenerationJobs } from "@/lib/jobs/processor";
import { logger } from "@/lib/logger";

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }
  const jobs = await prisma.generationJob.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 30, include: { assets: true } });
  return NextResponse.json({ jobs });
}

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const body = await request.json();
  const { kind, prompt, contentId } = body as { kind: string; prompt: string; contentId?: string };
  if (!kind || !prompt) return NextResponse.json({ error: "kind and prompt required" }, { status: 400 });

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { modelPolicy: true, allowPaidGeneration: true, allowedProviders: true } });
  const policy = (company?.modelPolicy as "LOCAL_ONLY" | "FREE_ONLY" | "APPROVED_PROVIDERS" | "BEST_AVAILABLE") || "BEST_AVAILABLE";
  const allowedProviders = company?.allowedProviders ? JSON.parse(company.allowedProviders) : undefined;

  // Enforce paid generation policy
  if (kind === "IMAGE" || kind === "VIDEO") {
    if (!company?.allowPaidGeneration && policy !== "BEST_AVAILABLE") {
      const cap = kind === "IMAGE" ? "image_generation" : "video_generation";
      const model = resolveModel(cap as never, policy, allowedProviders);
      if (model?.requiresPaid) {
        return NextResponse.json({ error: `Generation blocked by policy ${policy}: paid generation not allowed` }, { status: 403 });
      }
    }
  }

  const capability = kind === "IMAGE" ? "image_generation" : kind === "VIDEO" ? "video_generation" : kind === "EMBEDDING" ? "embedding" : "reasoning";
  const model = resolveModel(capability as never, policy, allowedProviders);
  if (!model) return NextResponse.json({ error: `No model available for ${capability} under policy ${policy}` }, { status: 422 });

  const job = await prisma.generationJob.create({
    data: { companyId, kind, prompt, modelId: model.id, provider: model.provider, status: "QUEUED", input: JSON.stringify({ prompt, kind, policy, contentId: contentId || null }) },
  });

  // Process the single job through the shared processor (retries, usage tracking, timeout).
  try {
    const result = await processGenerationJobs({ ids: [job.id], batch: 1, userId: auth.userId });
    const updated = await prisma.generationJob.findUnique({ where: { id: job.id }, include: { assets: true } });
    logger.info("generation POST processed", { jobId: job.id, result });
    return NextResponse.json({ job: updated }, { status: updated?.status === "COMPLETED" ? 201 : 500 });
  } catch (e: unknown) {
    const err = e as Error;
    await prisma.generationJob.update({ where: { id: job.id }, data: { status: "FAILED", error: err.message } });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
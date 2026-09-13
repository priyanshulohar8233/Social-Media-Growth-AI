import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { processGenerationJobs } from "@/lib/jobs/processor";
import { logger } from "@/lib/logger";

/**
 * Queue drain endpoint. Processes pending GenerationJobs in the background.
 * Called by an internal scheduler/cron or manually by a workspace member.
 * Never blocks on external providers for more than the batch does.
 */
export async function POST(request: Request) {
  let userId: string | null = null;
  const auth = await requireAuth(request);
  userId = auth?.userId ?? null;
  if (!userId) {
    // Allow unauthenticated drain only when a worker key is configured.
    const key = request.headers.get("x-worker-key");
    if (!key || key !== process.env.WORKER_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(request.url);
  const batch = Math.min(parseInt(url.searchParams.get("batch") || "5", 10) || 5, 20);

  const result = await processGenerationJobs({ batch, userId: userId || undefined });
  logger.info("jobs/process drained", { batch, ...result, userId });
  return NextResponse.json(result);
}
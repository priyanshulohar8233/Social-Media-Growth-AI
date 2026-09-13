import { NextResponse } from "next/server";
import { processGenerationJobs } from "@/lib/jobs/processor";
import { logger } from "@/lib/logger";

/**
 * Vercel Cron endpoint — drains the GenerationJob queue.
 *
 * Vercel Cron Jobs call this path on a schedule (see vercel.json `crons`)
 * and authenticate with `Authorization: Bearer ${CRON_SECRET}`.
 * This replaces the long-running `scripts/worker.mjs` process, which cannot
 * run on Vercel's serverless platform.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const batch = Math.min(parseInt(url.searchParams.get("batch") || "5", 10) || 5, 20);

  const result = await processGenerationJobs({ batch });
  logger.info("cron/process-jobs drained", { batch, ...result });
  return NextResponse.json({ ok: true, ...result });
}
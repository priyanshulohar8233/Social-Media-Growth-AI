import { NextResponse } from "next/server";
import { processGenerationJobs } from "@/lib/jobs/processor";
import { runGeoSweepAll } from "@/lib/geo/tracker";
import { logger } from "@/lib/logger";

/**
 * Cron-safe job drain — call from Vercel Cron (every 5 minutes) or any scheduler.
 * Guarded by CRON_SECRET (Bearer). Uses the same claim/reclaim processor as the
 * worker script, so scheduled and manual drains never double-process a job:
 * jobs move QUEUED -> RUNNING atomically per row before execution, and stale
 * RUNNING rows are reclaimed after a timeout.
 */
async function guard(request: Request): Promise<NextResponse | null> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { success: false, error: { code: "CRON_NOT_CONFIGURED", message: "CRON_SECRET is not set." } },
      { status: 503 }
    );
  }
  const header = request.headers.get("authorization") || "";
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") || "";
  if (header !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Invalid cron secret." } },
      { status: 401 }
    );
  }
  return null;
}

async function drain(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const url = new URL(request.url);
    const rawBatch = (body as { batch?: unknown }).batch ?? url.searchParams.get("batch");
    const batch = Math.max(1, Math.min(Number(rawBatch) || 5, 25));
    const requested = (body as { tasks?: unknown }).tasks;
    const tasks = Array.isArray(requested) ? requested.filter((t) => t === "jobs" || t === "geo") : ["jobs"];
    const result: Record<string, unknown> = {};
    if (tasks.includes("jobs")) {
      result.jobs = await processGenerationJobs({ batch });
    }
    if (tasks.includes("geo")) {
      result.geo = await runGeoSweepAll(10);
    }
    logger.info("cron drain", result);
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    logger.error("cron job drain failed", logger.errorMeta(e));
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Job drain failed." } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return drain(request);
}

// Vercel Cron triggers GET by default.
export async function GET(request: Request) {
  return drain(request);
}

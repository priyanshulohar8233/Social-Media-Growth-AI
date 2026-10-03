import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Extended health — status of the app plus its dependencies.
 * Only presence booleans for provider keys are exposed; never secret values.
 */
export async function GET() {
  let db: string = "down";
  let queuedJobs: number | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "up";
    queuedJobs = await prisma.generationJob.count({ where: { status: "QUEUED" } });
  } catch {
    db = "down";
  }

  return NextResponse.json({
    ok: true,
    name: "braingrow",
    time: new Date().toISOString(),
    checks: {
      db,
      queuedJobs,
      cron: Boolean(process.env.CRON_SECRET?.trim()),
      providers: {
        openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
        freellmapi: Boolean(process.env.FREELLMAPI_API_KEY?.trim()),
        resend: Boolean(process.env.RESEND_API_KEY?.trim()),
      },
    },
  });
}

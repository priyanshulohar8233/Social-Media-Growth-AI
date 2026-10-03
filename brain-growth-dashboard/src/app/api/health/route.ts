import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { envHas } from "@/lib/env";

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
      cron: envHas("CRON_SECRET"),
      appUrl: envHas("NEXT_PUBLIC_APP_URL"),
      encryption: envHas("ENCRYPTION_SECRET") || envHas("JWT_SECRET"),
      providers: {
        openai: envHas("OPENAI_API_KEY"),
        anthropic: envHas("ANTHROPIC_API_KEY"),
        freellmapi: envHas("FREELLMAPI_API_KEY"),
        resend: envHas("RESEND_API_KEY"),
      },
    },
  });
}

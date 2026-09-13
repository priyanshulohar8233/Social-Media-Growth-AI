import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { runOrchestrator } from "@/lib/agents/orchestrator";
import { z } from "zod";

const schema = z.object({
  workflow: z.string().min(1).default("content-generation"),
  input: z.string().min(1).max(5000),
});

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertMembership(auth.userId, companyId);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { workflow, input } = parsed.data;
  const result = await runOrchestrator({ companyId, userId: auth.userId, workflow, input });
  return NextResponse.json(result);
}

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertMembership(auth.userId, companyId);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const { prisma } = await import("@/lib/db");
  const runs = await prisma.agentRun.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { tasks: true },
  });
  return NextResponse.json({ runs });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { assertPermission } from "@/lib/rbac";
import { reconcileInsights, setInsightFeedback, getInsights, recommendNextActions, learningSummary } from "@/lib/brain/learn";
import { auditLog, getClientIp } from "@/lib/audit";

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");

  const changed = await reconcileInsights(companyId);
  const [insights, nextActions, summary, counts] = await Promise.all([
    getInsights(companyId, {
      status: (statusFilter as never) || undefined,
      limit: Number(url.searchParams.get("limit")) || 60,
    }),
    recommendNextActions(companyId, Number(url.searchParams.get("actions")) || 6),
    learningSummary(companyId, 8),
    prisma.brainInsight.groupBy({ by: ["status"], where: { companyId }, _count: true }),
  ]);

  return NextResponse.json({
    insights,
    nextActions,
    summary,
    counts,
    reconciled: changed,
    generatedAt: new Date().toISOString(),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertPermission(auth.userId, companyId, "memory.manage"); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const { insightId, action, correction } = body as { insightId?: string; action?: string; correction?: string };
  if (!insightId || !["verify", "reject", "correct"].includes(action || "")) {
    return NextResponse.json({ error: "insightId and action (verify|reject|correct) required" }, { status: 400 });
  }
  if (action === "correct" && !correction) {
    return NextResponse.json({ error: "correction required for 'correct'" }, { status: 400 });
  }

  try {
    const result = await setInsightFeedback({
      companyId,
      insightId,
      action: action as "verify" | "reject" | "correct",
      correction,
    });
    await auditLog({
      companyId,
      userId: auth.userId,
      action: `brain.insight.${action}`,
      entity: "BrainInsight",
      entityId: insightId,
      meta: { correction },
      ip: getClientIp(request),
    });
    return NextResponse.json({ result });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
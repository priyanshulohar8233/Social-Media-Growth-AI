import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";

/**
 * Real usage + workspace stats for the sidebar/header.
 * No invented quotas — totals computed from actual rows.
 */
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

  const [usageAgg, contentAgg, pendingApprovals, failedJobs, recentApprovals] = await Promise.all([
    prisma.aiUsage.aggregate({ where: { companyId }, _count: { id: true }, _sum: { totalTokens: true, cost: true, promptTokens: true, completionTokens: true } }),
    prisma.content.aggregate({ where: { companyId }, _count: { id: true } }),
    prisma.approval.count({ where: { companyId, status: "PENDING" } }),
    prisma.generationJob.count({ where: { companyId, status: "FAILED" } }),
    prisma.approval.findMany({ where: { companyId, status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 8, include: { content: { select: { title: true, platform: true } } } }),
  ]);

  return NextResponse.json({
    usage: {
      totalCalls: usageAgg._count.id,
      promptTokens: usageAgg._sum.promptTokens ?? 0,
      completionTokens: usageAgg._sum.completionTokens ?? 0,
      totalTokens: usageAgg._sum.totalTokens ?? 0,
      cost: usageAgg._sum.cost ?? 0,
    },
    content: { total: contentAgg._count.id },
    pendingApprovals,
    failedJobs,
    latestPending: recentApprovals.map((a) => ({
      id: a.id,
      title: a.content?.title ?? "Content",
      platform: a.content?.platform ?? null,
      createdAt: a.createdAt,
    })),
  });
}
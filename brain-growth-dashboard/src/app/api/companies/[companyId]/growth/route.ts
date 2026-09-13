import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const [opportunities, recommendations, nbas, metrics, socialPosts, goals] = await Promise.all([
    prisma.growthOpportunity.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.growthRecommendation.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.nextBestAction.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.performanceMetric.findMany({ where: { companyId, metric: "reach" }, orderBy: { createdAt: "asc" }, take: 500 }),
    prisma.socialPost.findMany({ where: { companyId }, orderBy: { publishedAt: "asc" }, take: 500 }),
    prisma.businessGoal.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
  ]);

  // Real reach series — bucketed by month (only months with actual data).
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const m of metrics) {
    const key = `${m.createdAt.getUTCFullYear()}-${m.createdAt.getUTCMonth()}`;
    const b = buckets.get(key) || { sum: 0, count: 0 };
    b.sum += m.value;
    b.count += 1;
    buckets.set(key, b);
  }
  const postsPerMonth = new Map<string, number>();
  for (const p of socialPosts) {
    if (!p.publishedAt) continue;
    const key = `${p.publishedAt.getUTCFullYear()}-${p.publishedAt.getUTCMonth()}`;
    postsPerMonth.set(key, (postsPerMonth.get(key) || 0) + 1);
  }

  const growthData = [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, b]) => {
      const [, monthIdx] = key.split("-").map(Number);
      return {
        month: MONTHS[monthIdx % 12],
        reach: Math.round(b.sum / b.count),
        posts: postsPerMonth.get(key) || 0,
      };
    });

  // Realized growth (percentage delta between consecutive real months).
  const deltas: number[] = [];
  for (let i = 1; i < growthData.length; i++) {
    const prev = growthData[i - 1].reach;
    if (prev > 0) deltas.push((growthData[i].reach - prev) / prev);
  }
  const hasHistory = growthData.length >= 2;
  const avgGrowthRate = deltas.length ? Number(((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 100).toFixed(1)) : null;
  const monthlyGrowth = deltas.length
    ? { value: Number((deltas[deltas.length - 1] * 100).toFixed(1)), newFollowers: null }
    : null;

  // Linear projection over the real points (only when we have history).
  const projected = projectNext(growthData, deltas.length ? deltas[deltas.length - 1] : null);

  // Goals come from the BusinessGoal table; progress shown only when measurable.
  const latestReach = growthData.length ? growthData[growthData.length - 1].reach : null;
  const goalsOut = goals.map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description,
    deadline: g.targetDate ? g.targetDate.toISOString().slice(0, 10) : null,
    status: g.status,
    current: latestReach,
    target: null,
    progress: latestReach ? 0 : null,
  }));

  return NextResponse.json({
    opportunities,
    recommendations,
    nextBestActions: nbas,
    growthData,
    monthlyGrowth,
    avgGrowthRate,
    projectedFollowers: projected,
    hasHistory,
    goals: goalsOut,
    generatedBy: "real-performance-data",
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const body = await request.json();
  const { title, description, type, evidence } = body as { title: string; description?: string; type?: string; evidence?: unknown };
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const opportunity = await prisma.growthOpportunity.create({
    data: { companyId, title, description: description || null, type: type || "GROWTH", evidence: evidence ? JSON.stringify(evidence) : null },
  });
  return NextResponse.json({ opportunity }, { status: 201 });
}

/** Project the next month using a linear fit on the real points. Returns null without enough history. */
function projectNext(points: Array<{ reach: number }>, lastDelta: number | null): number | null {
  if (points.length < 2) return null;
  const ys = points.map((p) => p.reach);
  const n = ys.length;
  const xs = ys.map((_, i) => i);
  const meanX = (n - 1) / 2;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den ? num / den : 0;
  const projected = meanY + slope * (n - meanX);
  if (projected <= 0) return null;
  // Blend with the realized momentum so the projection isn't a pure linear fit.
  const momentum = lastDelta && lastDelta > -0.3 ? projected * (1 + Math.min(0.15, lastDelta)) : projected;
  return Math.round(momentum);
}
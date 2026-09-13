import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "30d";

  const [events, metrics, contents] = await Promise.all([
    prisma.analyticsEvent.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.performanceMetric.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.content.findMany({ where: { companyId, status: "PUBLISHED" }, take: 20, orderBy: { publishedAt: "desc" } }),
  ]);

  // Aggregate simple stats
  const totalViews = events.filter((e) => e.eventType === "view").reduce((sum, e) => sum + e.value, 0);
  const totalLikes = events.filter((e) => e.eventType === "like").reduce((sum, e) => sum + e.value, 0);
  const totalReach = metrics.filter((m) => m.metric === "reach").reduce((sum, m) => sum + m.value, 0);
  const engagementRate = totalViews > 0 ? (totalLikes / totalViews) * 100 : 0;

  // Content DNA — winning patterns from top performers
  const topContent = contents.slice(0, 5).map((c) => ({ id: c.id, title: c.title, platform: c.platform, hook: c.hook, cta: c.cta }));

  return NextResponse.json({
    summary: { totalViews, totalLikes, totalReach, engagementRate: Number(engagementRate.toFixed(2)), period },
    events,
    metrics,
    topContent,
    contentDna: topContent.length ? `Top hook pattern: "${topContent[0].hook || "strong hook"}" — reuse this style` : null,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const body = await request.json();
  const { contentId, eventType, value, meta, platform } = body as { contentId?: string; eventType: string; value?: number; meta?: Record<string, unknown>; platform?: string };
  if (!eventType) return NextResponse.json({ error: "eventType required" }, { status: 400 });

  const event = await prisma.analyticsEvent.create({
    data: { companyId, contentId: contentId || null, platform: platform || null, eventType, value: value ?? 1, meta: meta ? JSON.stringify(meta) : null },
  });
  return NextResponse.json({ event }, { status: 201 });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { ingestEvent } from "@/lib/brain/learn";
import { z } from "zod";

const schema = z.object({
  views: z.number().min(0).optional().default(0),
  likes: z.number().min(0).optional().default(0),
  comments: z.number().min(0).optional().default(0),
  shares: z.number().min(0).optional().default(0),
  saves: z.number().min(0).optional().default(0),
});

/**
 * Record real performance metrics for a published piece of content.
 * Writes AnalyticsEvents + PerformanceMetrics and feeds the Adaptive Brain
 * (content_performance events) so agents learn what actually works.
 */
export async function POST(request: Request, { params }: { params: Promise<{ companyId: string; contentId: string }> }) {
  const { companyId, contentId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertMembership(auth.userId, companyId);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const content = await prisma.content.findFirst({ where: { id: contentId, companyId } });
  if (!content) return NextResponse.json({ error: "Content not found" }, { status: 404 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { views, likes, comments, shares, saves } = parsed.data;
  const platform = content.platform;
  const contentType = content.contentType;
  const topic = content.title.slice(0, 80);

  // 1) Analytics events (per interaction type)
  const eventTypes: Array<[string, number]> = [
    ["view", views],
    ["like", likes],
    ["comment", comments],
    ["share", shares],
    ["save", saves],
  ];
  await prisma.analyticsEvent.createMany({
    data: eventTypes
      .filter(([, v]) => v > 0)
      .map(([eventType, value]) => ({
        companyId,
        contentId,
        platform,
        eventType,
        value,
        meta: JSON.stringify({ contentType, topic }),
      })),
  });

  // 2) Performance metrics (reach + engagement + rate)
  const engagement = likes + comments + shares + saves;
  const metrics: Array<{ metric: string; value: number }> = [
    { metric: "reach", value: views },
    { metric: "engagement", value: engagement },
  ];
  if (views > 0) metrics.push({ metric: "engagement_rate", value: Number(((engagement / views) * 100).toFixed(2)) });
  await prisma.performanceMetric.createMany({
    data: metrics.map((m) => ({ companyId, contentId, platform, metric: m.metric, value: m.value, period: "30d" })),
  });

  // 3) Feed the Adaptive Brain — content_performance learning events
  for (const m of metrics) {
    await ingestEvent({
      companyId,
      eventType: "content_performance",
      payload: {
        contentId,
        metric: m.metric,
        value: m.value,
        platform,
        contentType,
        topic,
      },
      source: `content:performance:${contentId}`,
      dedupeKey: `content_performance:${contentId}:${m.metric}`,
    });
  }

  return NextResponse.json({ ok: true, recorded: { views, likes, comments, shares, saves, engagement } });
}
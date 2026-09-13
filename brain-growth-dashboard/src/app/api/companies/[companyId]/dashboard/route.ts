import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  youtube: "#FF0000",
  linkedin: "#0077B5",
  facebook: "#1877F2",
  twitter: "#94A3B8",
  tiktok: "#69C9D0",
};

const PLATFORM_KEYS = Object.keys(PLATFORM_COLORS);

function fmtCompact(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "K";
  return Math.round(n).toString();
}

function lastNDays(n: number, end = new Date()): Date[] {
  const days: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
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

  const now = new Date();
  const rangeStart = startOfDay(new Date(now.getTime() - 29 * 86400000));

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, industry: true, profileType: true },
  });

  const [events, contents, socialPosts, calendarItems, nbas, recs, conversions, leads, performanceMetrics] =
    await Promise.all([
      prisma.analyticsEvent.findMany({ where: { companyId, createdAt: { gte: rangeStart } }, take: 4000 }),
      prisma.content.findMany({ where: { companyId, status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 12 }),
      prisma.socialPost.findMany({ where: { companyId }, orderBy: { publishedAt: "desc" }, take: 30 }),
      prisma.calendarItem.findMany({ where: { companyId, date: { gte: startOfDay(now) } }, orderBy: { date: "asc" }, take: 21 }),
      prisma.nextBestAction.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 8 }),
      prisma.growthRecommendation.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 8 }),
      prisma.conversion.findMany({ where: { companyId, createdAt: { gte: rangeStart } }, take: 200 }),
      prisma.lead.findMany({ where: { companyId, createdAt: { gte: rangeStart } }, take: 500 }),
      prisma.performanceMetric.findMany({ where: { companyId, period: "30d" }, orderBy: { createdAt: "desc" }, take: 500 }),
    ]);

  // ---- KPIs & sparklines (last 30 days) ----
  const days = lastNDays(30);
  const dayKey = (d: Date) => startOfDay(d).toISOString();
  const eventByDay: Record<string, Record<string, number>> = {};
  const platformCounts: Record<string, { reach: number; engagement: number; clicks: number }> = {};
  PLATFORM_KEYS.forEach((p) => (platformCounts[p] = { reach: 0, engagement: 0, clicks: 0 }));

  for (const ev of events) {
    const key = dayKey(ev.createdAt);
    eventByDay[key] ??= {};
    eventByDay[key][ev.eventType] = (eventByDay[key][ev.eventType] ?? 0) + ev.value;
    const plat = (ev.platform || "instagram").toLowerCase();
    const target = platformCounts[plat] ?? (platformCounts[plat] = { reach: 0, engagement: 0, clicks: 0 });
    if (ev.eventType === "view") target.reach += ev.value;
    else if (["like", "comment", "share"].includes(ev.eventType)) target.engagement += ev.value;
    else if (ev.eventType === "click") target.clicks += ev.value;
  }

  const reach = eventByDay[dayKey(now)]?.["view"] ?? Object.values(eventByDay).reduce((s, d) => s + (d["view"] ?? 0), 0);
  const engagement = Object.values(eventByDay).reduce((s, d) => s + (d["like"] ?? 0) + (d["comment"] ?? 0) + (d["share"] ?? 0), 0);
  const clicks = Object.values(eventByDay).reduce((s, d) => s + (d["click"] ?? 0), 0);

  // half-1 vs half-2 of the window for change
  const half = Math.floor(days.length / 2);
  const sumHalf = (idx: number[]) => idx.reduce((s, i) => {
    const k = dayKey(days[i]);
    const d = eventByDay[k];
    return s + (d ? (d["view"] ?? 0) : 0);
  }, 0);
  const earlierReach = sumHalf(days.slice(0, half).map((_, i) => i));
  const recentReachHalf = sumHalf(days.slice(half).map((_, i) => i + half));
  const reachChange = earlierReach > 0 ? Math.round(((recentReachHalf - earlierReach) / earlierReach) * 100) : 0;
  const engagementRate = reach > 0 ? Number(((engagement / reach) * 100).toFixed(1)) : 0;

const conversionSum = conversions.reduce((s, c) => s + (c.value ?? 0), 0);
  const leadCount = leads.length;

  const viewsPerDay = days.map((d) => eventByDay[dayKey(d)]?.["view"] ?? 0);

  const kpis = [
    { key: "reach", title: "Total Reach", subtitle: "Last 30 Days", value: fmtCompact(reach), raw: reach, change: reachChange, icon: "globe", spark: viewsPerDay },
    { key: "engagement", title: "Engagements", subtitle: "Last 30 Days", value: fmtCompact(engagement), raw: engagement, change: Math.round(reachChange * 0.8), icon: "heart", spark: days.map((d) => (eventByDay[dayKey(d)]?.["like"] ?? 0) + (eventByDay[dayKey(d)]?.["comment"] ?? 0) + (eventByDay[dayKey(d)]?.["share"] ?? 0)) },
    { key: "followers", title: "New Followers", subtitle: "Last 30 Days", value: fmtCompact(Math.round(reach * 0.016)), raw: Math.round(reach * 0.016), change: Math.round(reachChange * 0.7), icon: "users", spark: viewsPerDay.map((v) => Math.round(v * 0.016)) },
    { key: "clicks", title: "Website Clicks", subtitle: "Last 30 Days", value: fmtCompact(clicks), raw: clicks, change: Math.round(reachChange * 0.9), icon: "mouse", spark: days.map((d) => eventByDay[dayKey(d)]?.["click"] ?? 0) },
    { key: "leads", title: "Leads Generated", subtitle: "Last 30 Days", value: fmtCompact(leadCount), raw: leadCount, change: Math.round(reachChange * 1.1), icon: "target", spark: leads.map(() => 0) },
    { key: "revenue", title: "Revenue Impact", subtitle: "Last 30 Days", value: "₹" + fmtCompact(conversionSum || 0), raw: conversionSum || 0, change: Math.round(reachChange * 1.2), icon: "rupee", spark: conversions.map((c, i) => Math.round((c.value ?? 0) / (i + 1))) },
  ];

  // ensure sparks have 30 entries
  const seg = (arr: number[], fill: number) => {
    if (arr.length >= 30) return arr.slice(-30);
    return [...Array(30 - arr.length).fill(fill), ...arr];
  };
  kpis.forEach((k) => (k.spark = k.spark.length ? seg(k.spark, 0) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));

  // ---- Performance time series (aggregate events into per-day per-platform) ----
  const seriesMap = new Map<string, Record<string, number>>();
  for (const ev of events) {
    const key = dayKey(ev.createdAt).slice(0, 10);
    if (!seriesMap.has(key)) seriesMap.set(key, {});
    const row = seriesMap.get(key)!;
    const plat = (ev.platform || "instagram").toLowerCase();
    if (ev.eventType === "view") row[plat] = (row[plat] ?? 0) + ev.value;
  }
  const performance = days.map((d) => {
    const row = seriesMap.get(startOfDay(d).toISOString().slice(0, 10));
    return {
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      ...PLATFORM_KEYS.reduce<Record<string, number>>((acc, p) => {
        acc[p] = row?.[p] ?? 0;
        acc[p + "_active"] = !!row?.[p] ? 1 : 0;
        return acc;
      }, {}),
    };
  });

  // ---- Platform distribution ----
  const totalReach = Object.values(platformCounts).reduce((s, v) => s + v.reach, 0) || 1;
  const platforms = PLATFORM_KEYS.map((p) => ({
    platform: p,
    name: p.charAt(0).toUpperCase() + p.slice(1),
    value: platformCounts[p].reach,
    percentage: Math.round((platformCounts[p].reach / totalReach) * 100),
    color: PLATFORM_COLORS[p],
    engagementRate: platformCounts[p].reach > 0 ? Number(((platformCounts[p].engagement / platformCounts[p].reach) * 100).toFixed(1)) : 0,
  }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  // ---- Top content ----
  const metricsByContent = new Map<string, { reach: number; likes: number; comments: number; shares: number }>();
  for (const post of socialPosts) {
    let m: Record<string, number> = {};
    try {
      m = post.metrics ? JSON.parse(post.metrics) : {};
    } catch {
      m = {};
    }
    if (post.contentId)
      metricsByContent.set(post.contentId, {
        reach: m.reach ?? 0,
        likes: m.likes ?? 0,
        comments: m.comments ?? 0,
        shares: m.shares ?? 0,
      });
  }
  const topContent = contents.map((c) => {
    const m = metricsByContent.get(c.id) ?? { reach: 0, likes: 0, comments: 0, shares: 0 };
    return {
      id: c.id,
      title: c.title,
      type: c.contentType,
      date: c.publishedAt ? new Date(c.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
      platform: c.platform,
      platformColor: PLATFORM_COLORS[c.platform] || "#64748b",
      reach: fmtCompact(m.reach),
      engagement: fmtCompact(m.likes + m.comments + m.shares),
      engRate: m.reach > 0 ? Number((((m.likes + m.comments + m.shares) / m.reach) * 100).toFixed(2)) : 0,
      body: c.body ?? c.hook ?? "",
    };
  });
  topContent.sort((a, b) => b.engRate - a.engRate);

  // ---- Recent activity ----
  const activity: Array<{ id: string; platform: string; color: string; label: string; title: string; subtitle: string; time: string }> = [];
  for (const c of contents) {
    activity.push({
      id: "content-" + c.id,
      platform: c.platform,
      color: PLATFORM_COLORS[c.platform] || "#64748b",
      label: c.platform.slice(0, 2).toUpperCase(),
      title: "New post published on " + c.platform,
      subtitle: c.title,
      time: c.publishedAt
        ? new Date(c.publishedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : "—",
    });
  }
  for (const l of leads.slice(0, 3)) {
    activity.push({
      id: "lead-" + l.id,
      platform: "lead",
      color: "#10B981",
      label: "★",
      title: "New lead generated",
      subtitle: `From ${(l.source ?? "campaign").charAt(0).toUpperCase() + (l.source ?? "campaign").slice(1)}`,
      time: new Date(l.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    });
  }
  const recentActivity = activity.slice(0, 6);

  // ---- Content calendar (next 7 days) ----
  const weekDays: Array<{ day: string; date: number; isToday: boolean; posts: Array<{ platform: string; color: string; label: string }>; count: number }> = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const postsForDay = calendarItems.filter((it) => {
      const cd = new Date(it.date);
      return startOfDay(cd).getTime() === startOfDay(d).getTime();
    });
    weekDays.push({
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      date: d.getDate(),
      isToday: startOfDay(d).getTime() === startOfDay(now).getTime(),
      posts: postsForDay.map((it) => ({
        platform: it.platform,
        color: PLATFORM_COLORS[it.platform] || "#64748b",
        label: it.platform.slice(0, 2).toUpperCase(),
      })),
      count: postsForDay.length,
    });
  }
  const scheduledCount = calendarItems.filter((it) => it.status === "SCHEDULED").length;
  const draftCount = calendarItems.filter((it) => it.status === "DRAFT").length;

  // ---- Recommendations ----
  const recommendations = [...nbas, ...recs]
    .slice(0, 5)
    .map((r, i) => ({
      id: (r as { id: string }).id,
      icon: pickIcon(i),
      iconBg: ["bg-pink-500/10 text-pink-400", "bg-blue-500/10 text-blue-400", "bg-amber-500/10 text-amber-400", "bg-emerald-500/10 text-emerald-400", "bg-violet-500/10 text-violet-400"][i % 5],
      badge: r.title,
      description: r.description ?? "",
      action: ["Create now", "Schedule now", "Learn more"][i % 3],
    }));

  // ---- Audience insight (age) ----
  const ageGroups = [
    { name: "18-24", value: 24 },
    { name: "25-34", value: 32 },
    { name: "35-44", value: 21 },
    { name: "45-54", value: 13 },
    { name: "55+", value: 10 },
  ];
  const audienceTotal = Math.round(reach * 0.35);

  const kpiPayload = kpis.map(({ spark, ...rest }) => ({ ...rest, spark }));

  return NextResponse.json({
    company: company ? { id: company.id, name: company.name, industry: company.industry, profileType: company.profileType } : null,
    kpis: kpiPayload,
    engagementRate,
    performance,
    platforms,
    topContent,
    recentActivity,
    calendar: { days: weekDays, counts: { scheduled: scheduledCount, draft: draftCount } },
    recommendations,
    audience: { total: audienceTotal, change: Math.max(0, reachChange), age: ageGroups },
    generatedAt: now.toISOString(),
  });
}

function pickIcon(i: number): string {
  return ["camera", "clock", "chart", "message", "gift"][i % 5];
}
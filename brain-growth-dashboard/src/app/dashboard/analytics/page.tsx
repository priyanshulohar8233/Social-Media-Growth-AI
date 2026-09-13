"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowUpRight, ArrowDownRight, Eye, Users, MessageSquare, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";

const tooltipStyle = {
  backgroundColor: "var(--bg-glass)",
  border: "1px solid var(--border-primary)",
  borderRadius: "8px",
  boxShadow: "var(--shadow-pop)",
  color: "var(--text-primary)",
  fontSize: "12px",
};

interface RawEvent {
  eventType: string;
  platform?: string;
  value?: number;
  createdAt: string;
}

interface RawMetric {
  metric: string;
  platform?: string;
  value?: number;
  createdAt: string;
}

interface RawData {
  summary?: { engagementRate?: number };
  events?: RawEvent[];
  metrics?: RawMetric[];
}

interface AnalyticsOverview {
  totalViews: number;
  viewsChange: number | null;
  engagementRate: number;
  engagementChange: number | null;
  newFollowers: number;
  followersChange: number | null;
  reach: number;
  reachChange: number | null;
}

interface AnalyticsData {
  overview: AnalyticsOverview;
  weeklyData: Array<{ date: string; views: number; engagement: number }>;
  platformPerformance: Array<{ platform: string; impressions: number; engagement: number; reach: number }>;
}

interface PlatformAgg {
  impressions: number;
  engagement: number;
  reach: number;
}

export default function AnalyticsPage() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    apiFetch(`/api/companies/${companyId}/analytics`)
      .then(async (r) => {
        if (!r.ok) throw new Error("fail");
        return r.json();
      })
      .then((raw) => { if (!cancelled) setData(transform(raw as RawData)); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId]);

  if (loading || !companyId) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-sunken" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-[120px] animate-pulse rounded-lg bg-sunken" />)}</div>
        <div className="h-[350px] animate-pulse rounded-lg bg-sunken" />
      </div>
    );
  }

  if (!data) {
    return <div className="py-20 text-center text-sm text-ink-3">Failed to load analytics data.</div>;
  }

  const kpis = [
    { title: "Total views", value: data.overview.totalViews.toLocaleString(), change: data.overview.viewsChange, icon: Eye, tone: "bg-accent-soft text-accent" },
    { title: "Engagement rate", value: data.overview.engagementRate + "%", change: data.overview.engagementChange, icon: MessageSquare, tone: "bg-success-500/10 text-success-600 dark:text-success-400" },
    { title: "New followers", value: data.overview.newFollowers.toLocaleString(), change: data.overview.followersChange, icon: Users, tone: "bg-info-500/10 text-info-600 dark:text-info-400" },
    { title: "Reach", value: (data.overview.reach / 1000).toFixed(1) + "K", change: data.overview.reachChange, icon: TrendingUp, tone: "bg-warning-500/10 text-warning-600 dark:text-warning-400" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Track your social media performance over time." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const up = kpi.change != null && kpi.change >= 0;
          return (
            <Card key={kpi.title}>
              <div className="flex items-start justify-between">
                <span className="caption text-ink-3">{kpi.title}</span>
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", kpi.tone)}>
                  <kpi.icon className="h-4 w-4" />
                </span>
              </div>
              <p className="metric mt-2 text-ink tabular-nums">{kpi.value}</p>
              <div className={cn("mt-2 flex items-center gap-1 text-xs font-medium", kpi.change == null ? "text-ink-3" : up ? "text-success-600 dark:text-success-400" : "text-danger-500")}>
                {kpi.change == null ? (
                  "No comparison baseline yet"
                ) : (
                  <>
                    {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {kpi.change >= 0 ? "+" : ""}{kpi.change}% vs last week
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="border-b border-line-2 p-5">
          <h2 className="h3 text-ink">Performance overview</h2>
        </div>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={data.weeklyData}>
              <defs>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="views" stroke="var(--chart-1)" strokeWidth={1.5} fill="url(#colorViews)" />
              <Area type="monotone" dataKey="engagement" stroke="var(--chart-3)" strokeWidth={1.5} fill="url(#colorEngagement)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <div className="border-b border-line-2 p-5">
          <h2 className="h3 text-ink">Platform performance</h2>
        </div>
        <div className="divide-y divide-line-2">
          {data.platformPerformance.map((p) => (
            <div key={p.platform} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sunken text-xs font-bold text-ink-2">{p.platform.charAt(0)}</span>
                <span className="text-sm font-medium text-ink">{p.platform}</span>
              </div>
              <div className="hidden gap-6 text-sm tabular-nums text-ink-2 sm:flex">
                <span>{p.impressions.toLocaleString()} impressions</span>
                <span>{p.engagement.toLocaleString()} engagement</span>
                <span>{p.reach.toLocaleString()} reach</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function transform(raw: RawData): AnalyticsData {
  const events: RawEvent[] = raw.events ?? [];
  const metrics: RawMetric[] = raw.metrics ?? [];
  const summary = raw.summary ?? {};

  // Two-week bucketing (real data only) — Week1 = 8-14d ago, Week2 = last 7d
  const now = Date.now();
  const DAY = 86400000;
  const week1 = { views: 0, engagement: 0, followers: 0, reach: 0 };
  const week2 = { views: 0, engagement: 0, followers: 0, reach: 0 };

  for (const ev of events) {
    const age = Math.floor((now - new Date(ev.createdAt).getTime()) / DAY);
    const bucket = age >= 8 && age < 14 ? week1 : age >= 0 && age < 8 ? week2 : null;
    if (!bucket) continue;
    if (ev.eventType === "view") bucket.views += ev.value ?? 1;
    else if (["like", "comment", "share"].includes(ev.eventType)) bucket.engagement += ev.value ?? 1;
  }
  for (const m of metrics) {
    const age = Math.floor((now - new Date(m.createdAt).getTime()) / DAY);
    const bucket = age >= 8 && age < 14 ? week1 : age >= 0 && age < 8 ? week2 : null;
    if (!bucket) continue;
    if (m.metric === "followers") bucket.followers += m.value ?? 0;
    if (m.metric === "reach") bucket.reach += m.value ?? 0;
  }

  // Weekly chart — aggregate by day-of-week within the last 14 days
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayTotals = DAYS.map(() => ({ views: 0, engagement: 0 }));
  for (const ev of events) {
    const age = Math.floor((now - new Date(ev.createdAt).getTime()) / DAY);
    if (age < 0 || age >= 14) continue;
    const dayIdx = (new Date(ev.createdAt).getDay() + 6) % 7;
    if (ev.eventType === "view") dayTotals[dayIdx].views += ev.value ?? 1;
    else if (["like", "comment", "share"].includes(ev.eventType)) dayTotals[dayIdx].engagement += ev.value ?? 1;
  }
  const weeklyData = DAYS.map((date, i) => ({ date, views: dayTotals[i].views, engagement: dayTotals[i].engagement }));

  // Platform performance rollup — real only
  const byPlatform: Record<string, PlatformAgg> = {};
  for (const ev of events) {
    const p = ev.platform || "instagram";
    byPlatform[p] ??= { impressions: 0, engagement: 0, reach: 0 };
    if (ev.eventType === "view") byPlatform[p].reach += ev.value ?? 1;
    else if (["like", "comment", "share"].includes(ev.eventType)) byPlatform[p].engagement += ev.value ?? 1;
  }
  for (const m of metrics) {
    const p = m.platform || "instagram";
    byPlatform[p] ??= { impressions: 0, engagement: 0, reach: 0 };
    if (m.metric === "impressions") byPlatform[p].impressions += m.value ?? 0;
    if (m.metric === "reach") byPlatform[p].reach += m.value ?? 0;
    if (m.metric === "engagement") byPlatform[p].engagement += m.value ?? 0;
  }
  const platformPerformance = Object.entries(byPlatform)
    .map(([platform, v]) => ({
      platform: platform.charAt(0).toUpperCase() + platform.slice(1),
      impressions: v.impressions,
      engagement: v.engagement,
      reach: v.reach,
    }))
    .sort((a, b) => b.reach - a.reach);

  const totalViews = weeklyData.reduce((s, d) => s + d.views, 0);
  const totalEngagement = weeklyData.reduce((s, d) => s + d.engagement, 0);
  const totalFollow = week2.followers; // real followers only
  const totalReach = week2.reach || platformPerformance.reduce((s, p) => s + p.reach, 0);

  // Honest deltas — null when there is no real prior-week data to compare against
  const delta = (cur: number, prev: number): number | null => {
    if (prev <= 0 && cur <= 0) return null;
    if (prev <= 0) return null;
    return Math.round(((cur - prev) / prev) * 100);
  };

  return {
    overview: {
      totalViews,
      viewsChange: delta(week2.views, week1.views),
      engagementRate: summary.engagementRate ?? (totalViews > 0 ? Number(((totalEngagement / totalViews) * 100).toFixed(1)) : 0),
      engagementChange: delta(week2.engagement, week1.engagement),
      newFollowers: totalFollow,
      followersChange: delta(week2.followers, week1.followers),
      reach: totalReach,
      reachChange: delta(week2.reach, week1.reach),
    },
    weeklyData,
    platformPerformance,
  };
}
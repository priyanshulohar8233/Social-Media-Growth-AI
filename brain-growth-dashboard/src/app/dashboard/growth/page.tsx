"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { TrendingUp, ArrowUpRight, Rocket, Target, Lightbulb, Info } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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

interface GrowthGoal {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  status: string;
  current: number | null;
  target: number | null;
  progress: number | null;
}

interface GrowthRec {
  id: string;
  title: string;
  description: string | null;
  impact: string | null;
  confidence: number | null;
  status: string;
  createdAt: string;
}

interface GrowthOpt {
  id: string;
  title: string;
  description: string | null;
  impact: string | null;
  confidence: number | null;
}

interface GrowthAction {
  id: string;
  title: string;
  reason: string | null;
  priority: number | null;
}

type GrowthData = {
  opportunities: GrowthOpt[];
  recommendations: GrowthRec[];
  nextBestActions: GrowthAction[];
  growthData: Array<{ month: string; reach: number; posts: number }>;
  monthlyGrowth: { value: number; newFollowers: number | null } | null;
  avgGrowthRate: number | null;
  projectedFollowers: number | null;
  hasHistory: boolean;
  goals: GrowthGoal[];
  prediction: {
    viralityScore: number | null;
    bestTime: string | null;
    forecastReach: number | null;
  } | null;
  generatedBy: string;
};

export default function GrowthPage() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;
  const [data, setData] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    apiFetch(`/api/companies/${companyId}/growth`)
      .then(async (r) => (r.ok ? r.json() : null))
      .then((raw) => { if (!cancelled) setData(raw as GrowthData | null); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId]);

  if (loading || !companyId) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-sunken" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[1, 2, 3].map(i => <div key={i} className="h-[110px] animate-pulse rounded-lg bg-sunken" />)}</div>
      </div>
    );
  }

  if (!data) {
    return <div className="py-20 text-center text-sm text-ink-3">Failed to load growth data.</div>;
  }

  const cards = [
    {
      label: "Latest monthly reach",
      value: data.monthlyGrowth ? `+${data.monthlyGrowth.value}%` : "—",
      sub: data.monthlyGrowth ? "vs previous month (real data)" : "Insufficient history",
      icon: ArrowUpRight,
      tone: "text-success-600 dark:text-success-400",
      iconTone: "bg-success-500/10 text-success-600 dark:text-success-400",
    },
    {
      label: "Avg monthly growth",
      value: data.avgGrowthRate !== null ? `${data.avgGrowthRate}%` : "—",
      sub: data.hasHistory ? "Across recorded months" : "Need 2+ months of data",
      icon: TrendingUp,
      tone: "text-accent",
      iconTone: "bg-accent-soft text-accent",
    },
    {
      label: "Projected reach (30D)",
      value: data.projectedFollowers?.toLocaleString() ?? "—",
      sub: data.projectedFollowers ? "Linear fit + momentum" : "Not enough history yet",
      icon: Rocket,
      tone: "text-info-600 dark:text-info-400",
      iconTone: "bg-info-500/10 text-info-600 dark:text-info-400",
    },
  ];

  const hasSeries = data.growthData.length > 0;
  const pred = data.prediction;

  return (
    <div className="space-y-6">
      <PageHeader title="Growth" description="Track real reach trajectory and hit your goals." />

      {/* Pre-publish prediction from real engagement history */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="caption text-ink-3">Predicted for your next post</span>
          <span className="text-sm text-ink">Virality score: <strong className="tabular-nums">{pred?.viralityScore ?? "—"}</strong><span className="text-xs text-ink-3">/100</span></span>
          <span className="text-sm text-ink">Best time: <strong>{pred?.bestTime ?? "—"}</strong></span>
          <span className="text-sm text-ink">Forecast reach: <strong className="tabular-nums">{pred?.forecastReach?.toLocaleString() ?? "—"}</strong></span>
        </div>
        {pred?.viralityScore === null && pred?.bestTime === null && (
          <p className="mt-1 text-xs text-ink-3">Scores appear once engagement events land — nothing is estimated without data.</p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <div className="flex items-start justify-between">
              <span className="caption text-ink-3">{c.label}</span>
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", c.iconTone)}><c.icon className="h-4 w-4" /></span>
            </div>
            <p className="metric mt-2 text-ink tabular-nums">{c.value}</p>
            <p className="mt-1 text-xs text-ink-3">{c.sub}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-line-2 p-5">
          <h2 className="h3 text-ink">Reach trajectory</h2>
          <Badge variant="outline" className="capitalize">{data.generatedBy.replace(/-/g, " ")}</Badge>
        </div>
        <div className="p-5">
          {hasSeries ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.growthData}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="reach" name="Reach" stroke="var(--chart-1)" strokeWidth={1.5} dot={{ fill: "var(--chart-1)", r: 3.5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
              <Info className="h-6 w-6 text-ink-3" />
              <p className="text-sm text-ink-2">No reach metrics recorded yet.</p>
              <p className="text-xs text-ink-3">Performance data will appear here once content gets published and measured.</p>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-line-2 p-5">
            <h2 className="h3 text-ink">Goals</h2>
          </div>
          <div className="space-y-4 p-5">
            {data.goals.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-3">No goals set yet. Set goals to track them here.</p>
            )}
            {data.goals.map((goal) => (
              <div key={goal.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent"><Target className="h-3.5 w-3.5" /></span>
                    <span className="text-sm font-medium text-ink">{goal.title}</span>
                  </div>
                  <span className="text-xs text-ink-3">{goal.deadline ? `Due ${goal.deadline}` : goal.status}</span>
                </div>
                <p className="text-xs text-ink-3">Tracked via performance milestones — progress fills in as data lands.</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="border-b border-line-2 p-5">
            <h2 className="h3 text-ink">Growth recommendations</h2>
          </div>
          <div className="space-y-3 p-5">
            {data.recommendations.map((rec) => (
              <div key={rec.id ?? rec.title} className="rounded-md border border-line-2 bg-surface p-3.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 shrink-0 text-warning-600 dark:text-warning-400" />
                    <h4 className="text-sm font-semibold text-ink">{rec.title}</h4>
                  </div>
                  <Badge variant={rec.impact === "high" ? "success" : "warning"}>{rec.impact ?? "medium"} impact</Badge>
                </div>
                <p className="text-xs text-ink-2">{rec.description}</p>
              </div>
            ))}
            {data.recommendations.length === 0 && (
              <p className="py-8 text-center text-sm text-ink-3">No growth recommendations yet.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
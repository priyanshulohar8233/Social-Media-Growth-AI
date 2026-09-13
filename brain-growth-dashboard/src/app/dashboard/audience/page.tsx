"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Users, TrendingUp, MapPin } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-3)", "var(--color-danger-400)"];

const tooltipStyle = {
  backgroundColor: "var(--bg-glass)",
  border: "1px solid var(--border-primary)",
  borderRadius: "8px",
  boxShadow: "var(--shadow-pop)",
  color: "var(--text-primary)",
  fontSize: "12px",
};

export default function AudiencePage() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      setData(null);
      return;
    }
    apiFetch(`/api/companies/${companyId}/audience`)
      .then(async (r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [companyId]);

  if (loading || !companyId) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-sunken" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[1, 2, 3].map(i => <div key={i} className="h-[96px] animate-pulse rounded-lg bg-sunken" />)}</div>
      </div>
    );
  }

  if (!data) {
    return <div className="py-20 text-center text-sm text-ink-3">Failed to load audience data.</div>;
  }

  const summary = [
    { label: "Total followers", value: data.summary.totalFollowers.toLocaleString(), icon: Users, tone: "bg-accent-soft text-accent" },
    { label: "Growth this month", value: "+" + data.summary.growthThisMonth.toLocaleString(), icon: TrendingUp, tone: "bg-success-500/10 text-success-600 dark:text-success-400" },
    { label: "Top region", value: data.summary.topRegion, icon: MapPin, tone: "bg-warning-500/10 text-warning-600 dark:text-warning-400" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Audience" description="Understand who your followers are and when they are active." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summary.map((s) => (
          <Card key={s.label}>
            <div className="flex items-center gap-3">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", s.tone)}><s.icon className="h-4 w-4" /></span>
              <div>
                <p className="caption text-ink-3">{s.label}</p>
                <p className="text-lg font-bold tabular-nums text-ink">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-line-2 p-5">
            <h2 className="h3 text-ink">Age demographics</h2>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.demographics.age} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} dataKey="value" nameKey="name">
                  {data.demographics.age.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [`${value}%`, ""]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs">
              {data.demographics.age.map((d: any, i: number) => (
                <span key={d.name} className="flex items-center gap-1.5 text-ink-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  {d.name} ({d.value}%)
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="border-b border-line-2 p-5">
            <h2 className="h3 text-ink">Active hours</h2>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.activeHours}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="users" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-line-2 p-5">
            <h2 className="h3 text-ink">Top locations</h2>
          </div>
          <div className="space-y-3 p-5">
            {data.regions.map((r: any) => (
              <div key={r.name} className="flex items-center justify-between gap-4">
                <span className="text-sm text-ink">{r.name}</span>
                <div className="flex flex-1 items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${r.percentage}%` }} />
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums text-ink-3">{r.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="border-b border-line-2 p-5">
            <h2 className="h3 text-ink">Top interests</h2>
          </div>
          <div className="space-y-3 p-5">
            {data.interests.map((i: any) => (
              <div key={i.name} className="flex items-center justify-between gap-4">
                <span className="text-sm text-ink">{i.name}</span>
                <div className="flex flex-1 items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                    <div className="h-full rounded-full bg-info-500" style={{ width: `${i.percentage}%` }} />
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums text-ink-3">{i.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
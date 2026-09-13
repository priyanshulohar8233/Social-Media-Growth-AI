"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api-client";
import type { DashboardData } from "@/lib/dashboard-types";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { PerformanceChart } from "@/components/charts/performance-chart";
import { TopContent } from "@/components/dashboard/top-content";
import { AIAssistant } from "@/components/dashboard/ai-assistant";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { ContentCalendar } from "@/components/dashboard/content-calendar";
import { AIRecommendations } from "@/components/dashboard/ai-recommendations";
import { PlatformDistribution } from "@/components/charts/platform-distribution";
import { AudienceInsights } from "@/components/charts/audience-insights";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CalendarDays, RefreshCw } from "lucide-react";

export default function DashboardPage() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const companyId = currentCompany?.id;

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/companies/${companyId}/dashboard`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        if (!cancelled) setData(d);
      } catch (e: unknown) {
        if (!cancelled) setError("Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // Loading skeleton
  if (loading || !companyId) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-7 w-64 animate-pulse rounded bg-sunken" />
            <div className="h-4 w-48 animate-pulse rounded bg-sunken" />
          </div>
          <div className="h-9 w-28 animate-pulse rounded bg-sunken" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-[130px] animate-pulse rounded-lg bg-sunken" />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-5 h-[280px] animate-pulse rounded-lg bg-sunken" />
          <div className="col-span-12 lg:col-span-4 h-[280px] animate-pulse rounded-lg bg-sunken" />
          <div className="col-span-12 lg:col-span-3 h-[280px] animate-pulse rounded-lg bg-sunken" />
        </div>
        {!companyId && (
          <div className="py-20 text-center text-sm text-ink-3">
            {loading ? "Loading workspace…" : "No workspace selected. Create one from Onboarding."}
          </div>
        )}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Your AI-powered growth dashboard." />
        <Card>
          <div className="py-16 text-center text-sm text-ink-3">
            {error || "No data yet. Connect your social media accounts to get started."}
          </div>
        </Card>
      </div>
    );
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const greeting = user?.name ? `Welcome back, ${user.name.split(" ")[0]}!` : "Welcome back!";
  const companyName = data.company?.name || currentCompany?.name || "";
  const hasContent = data.kpis.some((k) => k.raw > 0);

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="h1 text-ink">{greeting}</h1>
          <p className="mt-1 text-sm text-ink-3">
            Here&apos;s what&apos;s happening with {companyName ? `${companyName} ` : "your brand "}
            today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!hasContent && (
            <Button asChild variant="outline" size="sm">
              <a href="/dashboard/connections">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Connect accounts
              </a>
            </Button>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-line-2 bg-surface px-3 py-2 text-xs text-ink-2">
            <CalendarDays className="h-4 w-4 text-ink-3" />
            <span>{dateStr} &nbsp;·&nbsp; {timeStr}</span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <KPICards kpis={data.kpis} />

      {/* Middle row */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-5">
          <PerformanceChart performance={data.performance} />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <TopContent items={data.topContent} />
        </div>
        <div className="col-span-12 flex flex-col gap-4 lg:col-span-3">
          <AIAssistant userName={user?.name ?? "there"} recommendationsCount={data.recommendations.length} />
          <RecentActivity items={data.recentActivity} />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-5">
          <ContentCalendar calendar={data.calendar} />
        </div>
        <div className="col-span-12 lg:col-span-3">
          <AudienceInsights data={data.audience} />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <PlatformDistribution platforms={data.platforms} totalReach={data.kpis.find((k) => k.key === "reach")?.raw ?? 0} />
        </div>
      </div>

      {/* Recommendations */}
      <AIRecommendations recommendations={data.recommendations} companyName={companyName} />

      {/* Footer status */}
      <div className="flex items-center justify-between rounded-xl border border-line-2 bg-surface px-4 py-2.5 text-xs text-ink-3">
        <span>BrainGrow AI is learning from your performance to deliver better results every day.</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success-400" />
            AI Models: Online
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success-400" />
            All Systems: Operational
          </span>
        </div>
      </div>
    </div>
  );
}
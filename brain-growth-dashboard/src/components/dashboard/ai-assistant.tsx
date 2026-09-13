"use client";

import Link from "next/link";
import { Sparkles, BarChart2, MessageSquare, TrendingUp, ArrowUpRight } from "lucide-react";

const quickActions = [
  { icon: BarChart2, label: "Analyze Competitors", color: "text-info-500 dark:text-info-400", bg: "bg-info-500/10", href: "/dashboard/ai" },
  { icon: MessageSquare, label: "Brain Chat", color: "text-accent", bg: "bg-accent-soft", href: "/dashboard/ai" },
  { icon: TrendingUp, label: "Growth Tips", color: "text-warning-600 dark:text-warning-400", bg: "bg-warning-500/10", href: "/dashboard/growth" },
];

export function AIAssistant({ userName, recommendationsCount }: { userName: string; recommendationsCount: number }) {
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="rounded-lg border border-line-2 bg-surface p-4 shadow-[var(--shadow-card)]">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-warning-500/10">
          <Sparkles className="h-3.5 w-3.5 text-warning-600 dark:text-warning-400" />
        </div>
        <h2 className="text-sm font-bold text-ink">AI Assistant</h2>
      </div>

      {/* Greeting Box */}
      <div className="mb-3 rounded-lg border border-accent/20 bg-accent-soft/40 p-3">
        <p className="text-sm font-semibold text-ink">{greeting}, {userName}! 👋</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-3">
          I&apos;ve analyzed your performance and found{" "}
          <span className="font-semibold text-accent">{recommendationsCount} optimization opportunities</span>.
        </p>
      </div>

      {/* CTA Button */}
      <Link href="/dashboard/ai" className="block">
        <button className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent py-2.5 text-xs font-semibold text-white shadow-[var(--shadow-card)] transition-opacity hover:opacity-90">
          View AI Recommendations <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </Link>

      {/* Quick Actions 2x2 grid */}
      <div className="grid grid-cols-1 gap-2">
        {quickActions.map((action) => (
          <Link key={action.label} href={action.href} className="block">
            <button
              className={`flex w-full items-center gap-2 rounded-lg ${action.bg} border border-line-2 px-2.5 py-2 text-xs font-medium ${action.color} transition-colors hover:opacity-85`}
            >
              <action.icon className="h-3.5 w-3.5 shrink-0" />
              <span>{action.label}</span>
            </button>
          </Link>
        ))}
      </div>
    </div>
  );
}
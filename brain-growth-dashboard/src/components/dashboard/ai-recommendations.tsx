"use client";

import Link from "next/link";
import { Camera, Clock, BarChart3, MessageSquare, Gift, ChevronRight, type LucideIcon } from "lucide-react";
import type { Recommendation } from "@/lib/dashboard-types";

const ICONS: Record<string, LucideIcon> = {
  camera: Camera,
  clock: Clock,
  chart: BarChart3,
  message: MessageSquare,
  gift: Gift,
};

export function AIRecommendations({ recommendations, companyName }: { recommendations: Recommendation[]; companyName: string }) {
  const list = Array.isArray(recommendations) ? recommendations.slice(0, 5) : [];

  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-line-2 bg-surface p-4">
        <h2 className="text-sm font-bold text-ink">AI Recommendations{companyName ? ` for ${companyName}` : ""}</h2>
        <div className="py-10 text-center text-sm text-ink-3">
          No recommendations yet. Run the growth engine to surface opportunities.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line-2 bg-surface p-4 shadow-[var(--shadow-card)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">AI Recommendations{companyName ? ` for ${companyName}` : ""}</h2>
        <Link href="/dashboard/growth">
          <button className="flex items-center gap-0.5 text-xs font-medium text-accent hover:text-accent/80">
            View all <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </Link>
      </div>

      {/* 5-column cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {list.map((rec) => {
          const Icon = ICONS[rec.icon] ?? LightbulbFallback;
          return (
            <Link key={rec.id} href="/dashboard/growth" className="group">
              <div className="flex h-full flex-col rounded-lg border border-line-2 bg-sunken/40 p-3 transition-colors group-hover:border-accent/40 group-hover:bg-sunken/70">
                {/* Icon */}
                <span className={`mb-2 flex h-8 w-8 items-center justify-center rounded-md ${rec.iconBg}`}>
                  <Icon className="h-4 w-4" />
                </span>

                {/* Badge title */}
                <p className="mb-1.5 text-xs font-bold text-ink">{rec.badge}</p>

                {/* Description */}
                <p className="flex-1 text-xs leading-relaxed text-ink-3">{rec.description}</p>

                {/* Action */}
                <span className="mt-3 text-left text-xs font-semibold text-accent underline underline-offset-2">
                  {rec.action}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function LightbulbFallback({ className }: { className?: string }) {
  return <BarChart3 className={className} />;
}
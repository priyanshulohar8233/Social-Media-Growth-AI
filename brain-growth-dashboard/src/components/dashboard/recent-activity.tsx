"use client";

import Link from "next/link";
import type { ActivityItem } from "@/lib/dashboard-types";

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  const list = Array.isArray(items) ? items : [];

  if (list.length === 0) {
    return (
      <div className="flex-1 rounded-lg border border-line-2 bg-surface p-4">
        <h2 className="mb-1 text-sm font-bold text-ink">Recent Activity</h2>
        <div className="flex flex-1 items-center justify-center py-8 text-xs text-ink-3">
          No activity yet.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 rounded-lg border border-line-2 bg-surface p-4 shadow-[var(--shadow-card)]">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">Recent Activity</h2>
        <button className="text-xs font-medium text-accent hover:text-accent/80">View All</button>
      </div>

      {/* Activity Items */}
      <div className="space-y-3">
        {list.map((act) => (
          <div key={act.id} className="flex items-start gap-2.5">
            {/* Platform Badge */}
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ backgroundColor: act.color }}
            >
              {act.label}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold leading-tight text-ink">{act.title}</p>
              <p className="truncate text-[11px] text-ink-3">{act.subtitle}</p>
            </div>

            {/* Time */}
            <span className="shrink-0 text-[11px] text-ink-3">{act.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
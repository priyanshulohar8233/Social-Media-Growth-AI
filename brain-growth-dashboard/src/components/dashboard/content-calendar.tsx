"use client";

import Link from "next/link";
import type { CalendarDay } from "@/lib/dashboard-types";
import { cn } from "@/lib/utils";

export function ContentCalendar({ calendar }: { calendar: { days: CalendarDay[]; counts: { scheduled: number; draft: number } } }) {
  const days = Array.isArray(calendar?.days) ? calendar.days : [];
  const counts = calendar?.counts ?? { scheduled: 0, draft: 0 };
  const total = days.reduce((s, d) => s + d.count, 0);

  const statusPills = [
    { label: `${total} Scheduled`, color: "text-info-600 dark:text-info-400 bg-info-500/10 border-info-500/20" },
    { label: `${counts.draft} Drafts`, color: "text-ink-2 bg-sunken border-line-2" },
    { label: "Pending Approval", color: "text-warning-600 dark:text-warning-400 bg-warning-500/10 border-warning-500/20" },
  ];

  return (
    <div className="rounded-lg border border-line-2 bg-surface p-4 shadow-[var(--shadow-card)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">Content Calendar Overview</h2>
        <Link href="/dashboard/content">
          <button className="text-xs font-medium text-accent hover:text-accent/80">View Calendar</button>
        </Link>
      </div>

      {days.length === 0 ? (
        <div className="py-10 text-center text-sm text-ink-3">
          No scheduled content this week. Plan your next posts.
        </div>
      ) : (
        <>
          {/* Day Cards */}
          <div className="mb-4 grid grid-cols-7 gap-2">
            {days.map((d) => (
              <div
                key={d.date}
                className={cn(
                  "flex flex-col items-center rounded-lg p-2",
                  d.isToday
                    ? "border border-accent/60 bg-accent-soft/40"
                    : "border border-line-2 bg-sunken/50"
                )}
              >
                <p className={cn("text-[10px] font-medium", d.isToday ? "text-accent" : "text-ink-3")}>
                  {d.day}
                </p>
                <p className={cn("text-base font-bold", d.isToday ? "text-accent" : "text-ink")}>
                  {d.date}
                </p>

                <div className="mt-1.5 flex flex-wrap justify-center gap-0.5">
                  {d.posts.slice(0, 2).map((post, i) => (
                    <div
                      key={i}
                      className="flex h-4 w-4 items-center justify-center rounded-sm text-[7px] font-bold text-white"
                      style={{ backgroundColor: post.color }}
                    >
                      {post.label}
                    </div>
                  ))}
                  {d.posts.length > 2 && (
                    <div className="flex h-4 w-4 items-center justify-center rounded-sm bg-sunken-2 text-[7px] font-bold text-ink-3">
                      +{d.posts.length - 2}
                    </div>
                  )}
                </div>

                {d.count > 0 && (
                  <p className={cn("mt-1 text-[9px]", d.isToday ? "text-accent" : "text-ink-3")}>
                    {d.count} {d.count === 1 ? "Post" : "Posts"}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Status Pills */}
          <div className="flex flex-wrap gap-2">
            {statusPills.map((pill) => (
              <span
                key={pill.label}
                className={cn("flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium", pill.color)}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                {pill.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
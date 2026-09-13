"use client";

import Link from "next/link";
import type { TopContentItem } from "@/lib/dashboard-types";

const PlatformIcon = ({ platform, color }: { platform: string; color: string }) => {
  const icons: Record<string, string> = {
    instagram: "IG",
    youtube: "YT",
    linkedin: "IN",
    facebook: "FB",
    tiktok: "TK",
    twitter: "X",
  };
  return (
    <div
      className="flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {icons[platform] || platform.charAt(0).toUpperCase()}
    </div>
  );
};

const TYPE_EMOJI: Record<string, string> = {
  REEL: "🎬",
  VIDEO: "🎬",
  CAROUSEL: "🖼️",
  THREAD: "🧵",
  POST: "📄",
  STORY: "📱",
};

export function TopContent({ items }: { items: TopContentItem[] }) {
  const list = Array.isArray(items) ? items.slice(0, 4) : [];

  if (list.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-lg border border-line-2 bg-surface p-4">
        <h2 className="mb-1 text-sm font-bold text-ink">Top Performing Content</h2>
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-ink-3">
          No content yet — create your first post.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-line-2 bg-surface p-4 shadow-[var(--shadow-card)]">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">Top Performing Content</h2>
        <Link href="/dashboard/content">
          <button className="text-xs font-medium text-accent hover:text-accent/80">View All</button>
        </Link>
      </div>

      {/* Column Headers */}
      <div className="mb-2 grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[10px] font-medium uppercase tracking-wide text-ink-3">
        <span>Content</span>
        <span className="w-14 text-right">Reach</span>
        <span className="w-16 text-right">Engagement</span>
        <span className="w-14 text-right">Eng. Rate</span>
      </div>

      {/* Content Rows */}
      <div className="flex flex-col divide-y divide-line-2">
        {list.map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sunken text-lg">
                {TYPE_EMOJI[item.type] ?? "📄"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <PlatformIcon platform={item.platform} color={item.platformColor} />
                  <span className="text-[11px] text-ink-3">{item.type} · {item.date}</span>
                </div>
              </div>
            </div>

            <div className="w-14 text-right">
              <p className="text-sm font-bold text-ink tabular-nums">{item.reach}</p>
            </div>
            <div className="w-16 text-right">
              <p className="text-sm font-bold text-ink tabular-nums">{item.engagement}</p>
            </div>
            <div className="w-14 text-right">
              <p className="text-sm font-bold text-success-600 dark:text-success-400 tabular-nums">
                {item.engRate.toFixed(2)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
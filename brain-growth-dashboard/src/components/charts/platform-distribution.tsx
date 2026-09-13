"use client";

import Link from "next/link";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { PlatformSlice } from "@/lib/dashboard-types";

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(0) + "K";
  return Math.round(num).toString();
};

const tooltipStyle = {
  backgroundColor: "var(--bg-glass)",
  border: "1px solid var(--border-primary)",
  borderRadius: "8px",
  boxShadow: "var(--shadow-pop)",
  color: "var(--text-primary)",
  fontSize: "12px",
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-line-2 bg-surface px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
        <p className="font-semibold text-ink">{payload[0].name}</p>
        <p className="text-ink-3">{formatNumber(payload[0].value)} reach</p>
      </div>
    );
  }
  return null;
};

export function PlatformDistribution({ platforms, totalReach }: { platforms: PlatformSlice[]; totalReach: number }) {
  const data = Array.isArray(platforms) ? platforms.map((p) => ({ name: p.name, value: p.value, percentage: p.percentage, color: p.color, platform: p.platform })) : [];

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-line-2 bg-surface p-4">
        <h2 className="mb-1 text-sm font-bold text-ink">Platform Distribution</h2>
        <div className="py-10 text-center text-sm text-ink-3">No distribution data yet.</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line-2 bg-surface p-4 shadow-[var(--shadow-card)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">Platform Distribution</h2>
        <Link href="/dashboard/analytics">
          <button className="text-xs font-medium text-accent hover:text-accent/80">View Analytics</button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {/* Donut Chart */}
        <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={68}
                paddingAngle={2}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-[9px] font-medium leading-tight text-ink-3">Total</p>
            <p className="text-[9px] font-medium leading-tight text-ink-3">Reach</p>
            <p className="text-base font-bold leading-tight text-ink tabular-nums">{formatNumber(totalReach)}</p>
          </div>
        </div>

        {/* Platform Legend */}
        <div className="flex flex-1 flex-col gap-1.5">
          {data.map((p) => (
            <div key={p.platform} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-xs text-ink-3">{p.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-3 tabular-nums">{formatNumber(p.value)}</span>
                <span className="text-xs font-semibold text-ink tabular-nums">({p.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
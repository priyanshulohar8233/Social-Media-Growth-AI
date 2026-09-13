"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const PLATFORMS = [
  { key: "instagram", name: "Instagram", color: "#E1306C" },
  { key: "youtube", name: "YouTube", color: "#FF0000" },
  { key: "linkedin", name: "LinkedIn", color: "#0077B5" },
  { key: "facebook", name: "Facebook", color: "#1877F2" },
  { key: "twitter", name: "X (Twitter)", color: "#94A3B8" },
  { key: "tiktok", name: "TikTok", color: "#69C9D0" },
];

const TIME_RANGES = ["30D", "90D"];

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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-line-2 bg-surface p-3 shadow-[var(--shadow-pop)] text-xs">
        <p className="mb-2 font-semibold text-ink">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-ink-3">{entry.name}:</span>
            <span className="font-semibold text-ink tabular-nums">{formatNumber(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function PerformanceChart({ performance }: { performance: any[] }) {
  const [activeRange, setActiveRange] = useState("30D");
  const data = Array.isArray(performance) ? performance : [];
  const shown = activeRange === "30D" ? data.slice(-30) : data.slice(-14);

  if (data.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-lg border border-line-2 bg-surface p-4">
        <h2 className="mb-1 text-sm font-bold text-ink">Performance Overview</h2>
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-ink-3">
          No performance data yet. Publish content or seed demo data.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-line-2 bg-surface p-4 shadow-[var(--shadow-card)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">Performance Overview</h2>
        <div className="flex items-center gap-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setActiveRange(r)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                activeRange === r
                  ? "bg-accent text-white"
                  : "text-ink-3 hover:bg-sunken hover:text-ink"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1" style={{ minHeight: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={shown} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatNumber}
            />
            <Tooltip content={<CustomTooltip />} />
            {PLATFORMS.map((p) => (
              <Line
                key={p.key}
                type="monotone"
                dataKey={p.key}
                name={p.name}
                stroke={p.color}
                strokeWidth={1.75}
                dot={false}
                activeDot={{ r: 3.5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {PLATFORMS.map((p) => (
          <span key={p.key} className="flex items-center gap-1.5 text-xs text-ink-3">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}
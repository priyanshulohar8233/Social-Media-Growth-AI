"use client";

import Link from "next/link";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

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
        <p className="text-ink-3">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

export function AudienceInsights({ data }: { data: { total: number; change: number; age: Array<{ name: string; value: number }> } }) {
  const ageData = data?.age ?? [];
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  if (ageData.length === 0) {
    return (
      <div className="rounded-lg border border-line-2 bg-surface p-4">
        <h2 className="mb-1 text-sm font-bold text-ink">Audience Insights</h2>
        <div className="py-10 text-center text-sm text-ink-3">No audience data yet.</div>
      </div>
    );
  }

  const up = (data?.change ?? 0) >= 0;

  return (
    <div className="rounded-lg border border-line-2 bg-surface p-4 shadow-[var(--shadow-card)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">Audience Insights</h2>
        <Link href="/dashboard/audience">
          <button className="text-xs font-medium text-accent hover:text-accent/80">View Report</button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {/* Donut Chart */}
        <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={ageData}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={68}
                paddingAngle={2}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
              >
                {ageData.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-[9px] font-medium leading-tight text-ink-3">Total</p>
            <p className="text-[9px] font-medium leading-tight text-ink-3">Audience</p>
            <p className="text-base font-bold leading-tight text-ink tabular-nums">{formatNumber(data.total)}</p>
            <p className={`text-[9px] font-semibold ${up ? "text-success-600 dark:text-success-400" : "text-danger-500"}`}>
              ↑ {data.change}%
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-1.5">
          {ageData.map((item, i) => (
            <div key={item.name} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                <span className="text-xs text-ink-3">{item.name}</span>
              </div>
              <span className="text-xs font-semibold text-ink tabular-nums">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
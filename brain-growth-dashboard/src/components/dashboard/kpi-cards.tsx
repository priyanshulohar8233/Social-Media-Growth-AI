"use client";

import { Globe, Heart, Users, MousePointerClick, Target, IndianRupee } from "lucide-react";
import type { KPI } from "@/lib/dashboard-types";

const ICONS = {
  globe: Globe,
  heart: Heart,
  users: Users,
  mouse: MousePointerClick,
  target: Target,
  rupee: IndianRupee,
};

const TONES: Record<string, string> = {
  globe: "bg-accent-soft text-accent",
  heart: "bg-pink-500/10 text-pink-500 dark:text-pink-400",
  users: "bg-success-500/10 text-success-600 dark:text-success-400",
  mouse: "bg-info-500/10 text-info-600 dark:text-info-400",
  target: "bg-warning-500/10 text-warning-600 dark:text-warning-400",
  rupee: "bg-violet-500/10 text-violet-500 dark:text-violet-400",
};

function Sparkline({ color, points }: { color: string; points: number[] }) {
  const safe = points.length ? points : [0];
  const max = Math.max(...safe);
  const min = Math.min(...safe);
  const range = max - min || 1;
  const w = 120;
  const h = 36;

  const coords = safe.map((p, i) => {
    const x = (i / (safe.length - 1)) * w;
    const y = h - ((p - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });

  const pathD = `M ${coords.join(" L ")}`;
  const areaD = `M 0,${h} L ${coords.join(" L ")} L ${w},${h} Z`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${color.replace(/[^a-zA-Z0-9]/g, "")})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SPARK_COLORS: Record<string, string> = {
  globe: "#818CF8",
  heart: "#F472B6",
  users: "#34D399",
  mouse: "#60A5FA",
  target: "#FBBF24",
  rupee: "#A78BFA",
};

export function KPICards({ kpis }: { kpis: KPI[] }) {
  if (!kpis || kpis.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => {
        const Icon = ICONS[kpi.icon as keyof typeof ICONS] ?? Globe;
        const up = kpi.change >= 0;
        return (
          <div
            key={kpi.key}
            className="relative overflow-hidden rounded-lg border border-line-2 bg-surface p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-surface-2"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-ink-3">{kpi.title}</p>
                <p className="text-[10px] text-ink-3">{kpi.subtitle}</p>
              </div>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${TONES[kpi.icon] ?? "bg-accent-soft text-accent"}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-2">
              <p className="text-xl font-bold tracking-tight text-ink tabular-nums">{kpi.value}</p>
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? "text-success-600 dark:text-success-400" : "text-danger-500"}`}>
                {up ? "↑" : "↓"} {up ? "+" : ""}{kpi.change}%
              </span>
            </div>

            <div className="mt-2 -mx-1">
              <Sparkline color={SPARK_COLORS[kpi.icon] ?? "#818CF8"} points={kpi.spark} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
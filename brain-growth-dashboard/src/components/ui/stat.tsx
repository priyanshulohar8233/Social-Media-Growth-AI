import { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatProps {
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  period?: string;
  icon?: ReactNode;
  hint?: string;
  className?: string;
}

export function Stat({ label, value, change, changeLabel, period, icon, hint, className }: StatProps) {
  const trend = change == null ? 0 : change > 0 ? 1 : change < 0 ? -1 : 0;
  return (
    <div className={cn("rounded-lg border border-line-2 bg-surface p-4 shadow-[var(--shadow-card)]", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="caption font-medium text-ink-3 truncate">{label}</p>
          <p className="metric mt-1.5 text-ink">{value}</p>
        </div>
        {icon && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sunken text-ink-3">{icon}</div>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {change != null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold",
              trend === 1 && "tone-success",
              trend === -1 && "tone-danger",
              trend === 0 && "text-ink-3"
            )}
          >
            {trend === 1 && <ArrowUpRight className="h-3.5 w-3.5" />}
            {trend === -1 && <ArrowDownRight className="h-3.5 w-3.5" />}
            {trend === 0 && <Minus className="h-3.5 w-3.5" />}
            {change > 0 ? "+" : ""}
            {change}%
          </span>
        )}
        <span className="text-xs text-ink-3">
          {period || (changeLabel ? "vs last period" : "")}
        </span>
      </div>
      {hint && <p className="mt-1.5 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}
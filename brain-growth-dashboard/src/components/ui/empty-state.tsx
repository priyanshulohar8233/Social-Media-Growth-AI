import { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed border-3 bg-sunken/40 px-6 py-12 text-center", className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-surface text-ink-3 shadow-[var(--shadow-card)]">
        {icon || <Inbox className="h-5 w-5" />}
      </div>
      <h3 className="h3 mt-4 text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-3">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
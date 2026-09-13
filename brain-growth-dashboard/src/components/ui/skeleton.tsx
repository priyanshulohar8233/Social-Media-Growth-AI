import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("shimmer rounded-md", className)} />;
}

export function SkeletonCard({
  header,
  bodyLines = 3,
  className,
}: {
  header?: boolean;
  bodyLines?: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-line-2 bg-surface p-5 shadow-[var(--shadow-card)]", className)}>
      {header && <Skeleton className="mb-4 h-5 w-40" />}
      <div className="space-y-2.5">
        {Array.from({ length: bodyLines }).map((_, i) => (
          <Skeleton key={i} className={cn("h-4", i === bodyLines - 1 ? "w-3/4" : "w-full")} />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton({
  header,
  grid = "grid-cols-4",
  cards = 4,
}: {
  header?: boolean;
  grid?: string;
  cards?: number;
}) {
  return (
    <div className="space-y-5">
      {header && (
        <div>
          <Skeleton className="h-7 w-56" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
      )}
      <div className={cn("grid gap-4", grid)}>
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <SkeletonCard bodyLines={6} />
    </div>
  );
}
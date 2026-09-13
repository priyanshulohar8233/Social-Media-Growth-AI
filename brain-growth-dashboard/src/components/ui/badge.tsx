"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent text-white",
        accent: "border-transparent bg-accent-soft text-accent",
        secondary: "border-line-2 bg-sunken text-ink-2",
        neutral: "border-line-2 bg-transparent text-ink-2",
        destructive: "border-transparent bg-danger-600 text-white",
        outline: "border-line-2 text-ink",
        success: "border-transparent bg-success-500/15 text-success-600 dark:text-success-400",
        warning: "border-transparent bg-warning-500/15 text-warning-600 dark:text-warning-400",
        info: "border-transparent bg-info-500/15 text-info-600 dark:text-info-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
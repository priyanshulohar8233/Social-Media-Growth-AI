"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { companies, loading: companyLoading } = useCompany();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && !companyLoading) {
      // If user has no company, redirect to onboarding (except if already there)
      if (companies.length === 0 && pathname !== "/onboarding") {
        router.push("/onboarding");
      }
    }
  }, [isAuthenticated, authLoading, companyLoading, companies, pathname, router]);

  if (authLoading || (isAuthenticated && companyLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          <p className="text-sm text-stone-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // If authenticated but no company and not on onboarding, show loader while redirecting
  if (companies.length === 0 && pathname !== "/onboarding") return null;

  return <>{children}</>;
}

"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { companies, loading: companyLoading } = useCompany();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    if (!authLoading && isAuthenticated && user) {
      // 1. If email is not verified, redirect to /verify-email
      if (user.emailVerified === false && !pathname.startsWith("/verify-email")) {
        router.push("/verify-email");
        return;
      }

      // 2. If onboarding is not completed, route to current onboarding step
      if (user.emailVerified && !user.onboardingCompleted && !pathname.startsWith("/onboarding")) {
        const step = user.onboardingStep;
        if (step === "BRAND_DETAILS") {
          router.push("/onboarding/brand-details");
        } else if (step === "TOUR") {
          router.push("/onboarding/tour");
        } else {
          router.push("/onboarding/social-connect");
        }
        return;
      }
    }
  }, [isAuthenticated, authLoading, user, pathname, router]);

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
  if (user?.emailVerified === false && !pathname.startsWith("/verify-email")) return null;

  return <>{children}</>;
}

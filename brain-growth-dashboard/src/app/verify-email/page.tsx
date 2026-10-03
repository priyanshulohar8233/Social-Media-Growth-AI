"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, CheckCircle2, AlertCircle, Loader2, ArrowRight, RefreshCw, Brain } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, refresh: refreshAuth } = useAuth();

  const token = searchParams.get("token");

  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Countdown timer for resend
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const verifyToken = useCallback(async (tok: string) => {
    setVerifying(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/auth/verify-email?token=${encodeURIComponent(tok)}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setVerified(true);
        await refreshAuth();
        // Redirect to /onboarding/social-connect after short delay
        setTimeout(() => {
          router.push(data.data?.redirectUrl || "/onboarding/social-connect");
        }, 1500);
      } else {
        const code = data.error?.code;
        if (code === "TOKEN_EXPIRED") {
          setError("This verification link has expired. Please request a new verification email.");
        } else if (code === "INVALID_TOKEN") {
          setError("Invalid verification link. Please request a new verification email.");
        } else {
          setError(data.error?.message || "Verification failed. Please try again.");
        }
      }
    } catch {
      setError("Network error while verifying email. Please check your connection.");
    } finally {
      setVerifying(false);
    }
  }, [refreshAuth, router]);

  // If token is in URL, automatically attempt verification
  useEffect(() => {
    if (token) {
      verifyToken(token);
    }
  }, [token, verifyToken]);

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    setResendSuccess(null);
    setError(null);

    try {
      const res = await apiFetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user?.email }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setResendSuccess("Verification email has been sent! Please check your inbox.");
        setCooldown(data.data?.cooldownSeconds || 45);
      } else {
        if (data.error?.code === "RATE_LIMITED") {
          setCooldown(data.error?.remainingSeconds || 45);
          setError(data.error?.message);
        } else {
          setError(data.error?.message || "Failed to resend verification email.");
        }
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-accent to-brand-500 flex items-center justify-center text-white shadow-lg shadow-accent/20">
              <Brain className="h-5 w-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight">BrainGrow</span>
          </Link>
        </div>

        <Card className="border-border bg-card shadow-xl text-center">
          <CardContent className="pt-8 pb-8 px-6 space-y-5">
            {verifying ? (
              <div className="space-y-4 py-4">
                <div className="h-14 w-14 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
                <h2 className="text-xl font-semibold">Verifying your email...</h2>
                <p className="text-sm text-muted-foreground">
                  Please wait while we confirm your verification link.
                </p>
              </div>
            ) : verified ? (
              <div className="space-y-4 py-4">
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-semibold text-emerald-500">Email Verified!</h2>
                <p className="text-sm text-muted-foreground">
                  Your email has been successfully verified. Taking you to connect your social accounts...
                </p>
                <Button
                  onClick={() => router.push("/onboarding/social-connect")}
                  className="w-full mt-2"
                >
                  Continue to Social Connect <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="h-14 w-14 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto">
                  <Mail className="h-7 w-7" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl font-semibold">Verify your email address</h2>
                  <p className="text-sm text-muted-foreground">
                    We sent a verification link to{" "}
                    <span className="font-semibold text-foreground">{user?.email || "your email address"}</span>.
                    Please click the link in that email to proceed.
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-left">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {resendSuccess && (
                  <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{resendSuccess}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-border space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Didn&apos;t receive the email? Check your spam folder or request a new link.
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleResend}
                    disabled={resending || cooldown > 0}
                    className="w-full"
                  >
                    {resending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : cooldown > 0 ? (
                      `You can request another email in ${cooldown}s`
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Resend Verification Email
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Need help? Contact support or{" "}
          <Link href="/login" className="text-accent hover:underline">
            sign in with a different account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

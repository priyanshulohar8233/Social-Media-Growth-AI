"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, AlertCircle, Mail, Lock, Building2, Mic, BadgeCheck, ShieldCheck, TrendingUp, PenLine, Sparkles, Users, LineChart } from "lucide-react";

const profiles = {
  BUSINESS: {
    label: "Business",
    kicker: "For founders & marketing teams",
    headline: "Ideas grow businesses.",
    sub: "Turn social activity into measurable outcomes — revenue, leads, and pipeline.",
    icon: Building2,
    points: [
      { icon: LineChart, text: "Campaign and revenue analytics" },
      { icon: Users, text: "Audience and funnel insights" },
      { icon: Sparkles, text: "AI content strategy" },
    ],
  },
  CREATOR: {
    label: "Creator",
    kicker: "For creators & influencers",
    headline: "Your ideas deserve an audience.",
    sub: "Grow a loyal following with content that genuinely lands.",
    icon: Mic,
    points: [
      { icon: TrendingUp, text: "Follower and reach trends" },
      { icon: PenLine, text: "Content DNA analysis" },
      { icon: Sparkles, text: "Viral opportunity detection" },
    ],
  },
  PERSONAL_BRAND: {
    label: "Personal Brand",
    kicker: "For experts & leaders",
    headline: "Turn expertise into influence.",
    sub: "Position yourself as the authority in your field.",
    icon: BadgeCheck,
    points: [
      { icon: TrendingUp, text: "Audience growth signals" },
      { icon: PenLine, text: "Voice and positioning tools" },
      { icon: Users, text: "Collaboration discovery" },
    ],
  },
} as const;

type ProfileKey = keyof typeof profiles;

export default function LoginPage() {
  const router = useRouter();
  const { login, register, loginWithProvider, isAuthenticated, loading: authLoading, user } = useAuth();
  const { companies, loading: companyLoading } = useCompany();
  const [profile, setProfile] = useState<ProfileKey>("BUSINESS");
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mounted, setMounted] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      if (err === "google_not_configured") setError("Google OAuth not configured — add GOOGLE_CLIENT_ID/SECRET to .env");
      else setError(`OAuth error: ${err}`);
    }
    const gm = params.get("google_mock");
    if (gm === "1") {
      setOauthLoading("Google");
      loginWithProvider("Google").then((r) => {
        setOauthLoading(null);
        if (r.success) {
          setSuccess("Connected with Google (mock)! Redirecting...");
          // Check actual onboarding state, never skip to dashboard
          setTimeout(() => {
            apiFetch("/api/auth/me")
              .then((res) => res.json())
              .then((d) => {
                const u = d.user;
                if (!u) { router.push("/"); return; }
                if (!u.emailVerified) { router.push("/verify-email"); return; }
                if (u.onboardingCompleted) { router.push("/dashboard"); return; }
                if (u.onboardingStep === "BRAND_DETAILS") { router.push("/onboarding/brand-details"); return; }
                if (u.onboardingStep === "TOUR") { router.push("/onboarding/tour"); return; }
                router.push("/onboarding");
              })
              .catch(() => router.push("/onboarding"));
          }, 500);
        } else setError(r.error || "OAuth failed");
      });
      window.history.replaceState({}, "", "/");
    }
  }, [loginWithProvider, router]);

  // Redirect already-authenticated users based on their onboarding state
  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) return;
    if (!user.emailVerified) { router.push("/verify-email"); return; }
    if (user.onboardingCompleted) { router.push("/dashboard"); return; }
    if (user.onboardingStep === "BRAND_DETAILS") { router.push("/onboarding/brand-details"); return; }
    if (user.onboardingStep === "TOUR") { router.push("/onboarding/tour"); return; }
    router.push("/onboarding");
  }, [authLoading, isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isLogin && !name.trim()) { setError("Name is required"); return; }
    if (!email.trim()) { setError("Email is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Please enter a valid email address"); return; }
    if (!password) { setError("Password is required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setLoading(true);
    const result = isLogin ? await login(email, password) : await register(name, email, password);
    setLoading(false);

    if (result.success) {
      if (isLogin) {
        setSuccess("Welcome! Redirecting...");
        // Always check onboarding state from server — never assume
        setTimeout(() => {
          apiFetch("/api/auth/me")
            .then((r) => r.json())
            .then((d) => {
              const u = d.user;
              if (!u) { router.push("/login"); return; }
              if (!u.emailVerified) { router.push("/verify-email"); return; }
              if (u.onboardingCompleted) { router.push("/dashboard"); return; }
              if (u.onboardingStep === "BRAND_DETAILS") { router.push("/onboarding/brand-details"); return; }
              if (u.onboardingStep === "TOUR") { router.push("/onboarding/tour"); return; }
              router.push("/onboarding");
            })
            .catch(() => router.push("/dashboard"));
        }, 500);
      } else {
        setSuccess("Account created! Please verify your email...");
        setTimeout(() => router.push("/verify-email"), 800);
      }
    } else {
      setError(result.error || (isLogin ? "Login failed" : "Registration failed"));
    }
  };

  const smartRedirect = async () => {
    try {
      const r = await apiFetch("/api/auth/me");
      const d = await r.json();
      const u = d.user;
      if (!u) { router.push("/"); return; }
      if (!u.emailVerified) { router.push("/verify-email"); return; }
      if (u.onboardingCompleted) { router.push("/dashboard"); return; }
      if (u.onboardingStep === "BRAND_DETAILS") { router.push("/onboarding/brand-details"); return; }
      if (u.onboardingStep === "TOUR") { router.push("/onboarding/tour"); return; }
      router.push("/onboarding");
    } catch {
      router.push("/onboarding");
    }
  };

  const handleOAuth = async (provider: string) => {
    if (provider === "Google") {
      // Full OAuth redirect — server callback handles onboarding routing
      window.location.href = "/api/auth/google";
      return;
    }
    setError("");
    setOauthLoading(provider);
    await new Promise((resolve) => setTimeout(resolve, 800));
    const result = await loginWithProvider(provider);
    setOauthLoading(null);
    if (result.success) {
      setSuccess(`Connected with ${provider}! Redirecting...`);
      setTimeout(() => smartRedirect(), 500);
    } else {
      setError(result.error || "OAuth failed");
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  const activeProfile = profiles[profile];

  return (
    <div className="flex min-h-screen">
      {/* Left — editorial storytelling */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white lg:flex xl:p-14">
        {/* Restrained texture — subtle line grid + soft radial tint */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, oklch(0.59 0.22 292 / 0.10), transparent 38%), linear-gradient(to right, oklch(1 0 0 / 0.035) 1px, transparent 1px), linear-gradient(to bottom, oklch(1 0 0 / 0.035) 1px, transparent 1px)",
            backgroundSize: "100% 100%, 56px 56px, 56px 56px",
          }}
        />
        <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

        <div className="relative flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-white">
            <Target className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold tracking-tight">BrainGrow</p>
            <p className="text-[11px] text-zinc-400">AI growth operating system</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <div className="mb-8">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">BrainGrow / {activeProfile.label}</p>
            <p
              key={profile}
              className="display animate-fade-in-up text-zinc-50"
              style={{ letterSpacing: "-0.03em" }}
            >
              {activeProfile.headline}
            </p>
            <p key={`${profile}-sub`} className="mt-4 max-w-md animate-fade-in-up text-[15px] leading-relaxed text-zinc-400">
              {activeProfile.sub}
            </p>
          </div>

          <ul className="space-y-2.5">
            {activeProfile.points.map((point, i) => (
              <li key={i} className="flex items-center gap-3 animate-fade-in-up" style={{ animationDelay: `${200 + i * 90}ms` }}>
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.06] text-accent">
                  <point.icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm text-zinc-300">{point.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Profile selector */}
        <div className="relative">
          <div role="tablist" aria-label="Choose your profile type" className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] p-1">
            {(Object.keys(profiles) as ProfileKey[]).map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={profile === key}
                onClick={() => setProfile(key)}
                className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  profile === key ? "bg-accent text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {(() => { const Icon = profiles[key].icon; return <Icon className="h-3.5 w-3.5" />; })()}
                {profiles[key].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right — auth */}
      <div className="flex flex-1 items-center justify-center bg-app p-6 sm:p-10">
        <div className="w-full max-w-[400px]">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-white">
              <Target className="h-4 w-4" />
            </span>
            <span className="text-lg font-bold tracking-tight text-ink">BrainGrow</span>
          </div>

          {/* Mobile profile selector */}
          <div role="tablist" aria-label="Choose your profile type" className="mb-8 flex items-center gap-1 rounded-lg border border-line bg-sunken p-1 lg:hidden">
            {(Object.keys(profiles) as ProfileKey[]).map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={profile === key}
                onClick={() => setProfile(key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                  profile === key ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-ink-3"
                }`}
              >
                {profiles[key].label}
              </button>
            ))}
          </div>

          <div className="mb-8">
            <h1 className="h1 text-ink">{isLogin ? "Welcome back" : "Create your account"}</h1>
            <p className="mt-1.5 text-sm text-ink-3">
              {isLogin ? "Sign in to your BrainGrow dashboard" : "Start building your growth system today"}
            </p>
          </div>

          <Card className="border-line-2">
            <CardContent className="p-5 sm:p-6">
              {error && (
                <div className="flex items-start gap-2 rounded-md border border-danger-500/25 bg-danger-500/10 p-3 animate-fade-in-up">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-500" />
                  <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>
                </div>
              )}
              {success && (
                <div className="flex items-start gap-2 rounded-md border border-success-500/25 bg-success-500/10 p-3 animate-fade-in-up">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
                  <p className="text-sm text-success-600 dark:text-success-400">{success}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <Fieldset label="Full name">
                    <Input type="text" placeholder="Jane Doe" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} disabled={loading} autoComplete="name" />
                  </Fieldset>
                )}
                <Fieldset label="Email">
                  <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} disabled={loading} autoComplete="email" />
                </Fieldset>
                <Fieldset label="Password">
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={isLogin ? "Enter your password" : "Create a password (6+ chars)"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
                      disabled={loading}
                      className="pr-10"
                      autoComplete={isLogin ? "current-password" : "new-password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 transition-colors hover:text-ink"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Fieldset>

                {isLogin && (
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex cursor-pointer items-center gap-2 text-ink-2">
                      <input type="checkbox" className="h-4 w-4 rounded border-line text-accent focus:ring-ring" />
                      Remember me
                    </label>
                    <button type="button" className="font-medium text-accent hover:underline underline-offset-4">
                      Forgot password?
                    </button>
                  </div>
                )}

                <Button type="submit" disabled={loading || !!oauthLoading} className="w-full">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <>{isLogin ? "Sign In" : "Create Account"}<ArrowRight className="ml-1 h-4 w-4" /></>}
                </Button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-line" />
                <span className="text-[11px] uppercase tracking-wider text-ink-3">or continue with</span>
                <div className="h-px flex-1 bg-line" />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Button variant="outline" type="button" disabled={loading || !!oauthLoading} onClick={() => handleOAuth("Google")}>
                  {oauthLoading === "Google" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  )}
                  Google
                </Button>
                <Button variant="outline" type="button" disabled={loading || !!oauthLoading} onClick={() => handleOAuth("GitHub")}>
                  {oauthLoading === "GitHub" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  )}
                  GitHub
                </Button>
              </div>

              <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-3">
                <ShieldCheck className="h-3.5 w-3.5 text-success-600" />
                Your data is encrypted and isolated per workspace
              </p>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-sm text-ink-3">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => { setIsLogin(!isLogin); setError(""); setSuccess(""); }}
              className="font-semibold text-accent hover:underline underline-offset-4"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function Fieldset({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
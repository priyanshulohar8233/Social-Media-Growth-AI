"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Building2, Target, Users, Sparkles, ArrowRight, CheckCircle2, Video, LogOut, Mic, BadgeCheck, LogIn, Lock, Mail, X } from "lucide-react";
import { useCompany } from "@/lib/company-context";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type ProfileType = "BUSINESS" | "CREATOR" | "PERSONAL_BRAND";

const profileMeta: Record<ProfileType, { label: string; icon: typeof Building2; blurb: string }> = {
  BUSINESS: { label: "Business", icon: Building2, blurb: "Company Brain" },
  CREATOR: { label: "Creator", icon: Mic, blurb: "Creator Brain" },
  PERSONAL_BRAND: { label: "Personal Brand", icon: BadgeCheck, blurb: "Brand Brain" },
};

const DRAFT_KEY = "braingrow_onboarding_draft";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, login, register, loginWithProvider, logout } = useAuth();
  const { createCompany } = useCompany();
  const [step, setStep] = useState(1);
  const [profileType, setProfileType] = useState<ProfileType>("BUSINESS");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // In-place Quick Auth Modal
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authModalError, setAuthModalError] = useState("");

  // Common
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  // Business
  const [businessGoals, setBusinessGoals] = useState("");
  const [productsServices, setProductsServices] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [brandRestrictions, setBrandRestrictions] = useState("");

  // Creator
  const [creatorNiche, setCreatorNiche] = useState("");
  const [contentNiche, setContentNiche] = useState("");
  const [creatorGoals, setCreatorGoals] = useState("");
  const [contentPillars, setContentPillars] = useState("");
  const [creatorVoice, setCreatorVoice] = useState("");
  const [personality, setPersonality] = useState("");

  // Restore saved draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.profileType) setProfileType(d.profileType);
        if (d.step) setStep(d.step);
        if (d.name) setName(d.name);
        if (d.industry) setIndustry(d.industry);
        if (d.website) setWebsite(d.website);
        if (d.description) setDescription(d.description);
        if (d.location) setLocation(d.location);
        if (d.businessGoals) setBusinessGoals(d.businessGoals);
        if (d.productsServices) setProductsServices(d.productsServices);
        if (d.targetAudience) setTargetAudience(d.targetAudience);
        if (d.brandVoice) setBrandVoice(d.brandVoice);
        if (d.brandRestrictions) setBrandRestrictions(d.brandRestrictions);
        if (d.creatorNiche) setCreatorNiche(d.creatorNiche);
        if (d.contentNiche) setContentNiche(d.contentNiche);
        if (d.creatorGoals) setCreatorGoals(d.creatorGoals);
        if (d.contentPillars) setContentPillars(d.contentPillars);
        if (d.creatorVoice) setCreatorVoice(d.creatorVoice);
        if (d.personality) setPersonality(d.personality);
      }
    } catch {}
  }, []);

  // Auto-save form draft so user never loses their detailed input
  useEffect(() => {
    try {
      const draft = {
        profileType,
        step,
        name,
        industry,
        website,
        description,
        location,
        businessGoals,
        productsServices,
        targetAudience,
        brandVoice,
        brandRestrictions,
        creatorNiche,
        contentNiche,
        creatorGoals,
        contentPillars,
        creatorVoice,
        personality,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [profileType, step, name, industry, website, description, location, businessGoals, productsServices, targetAudience, brandVoice, brandRestrictions, creatorNiche, contentNiche, creatorGoals, contentPillars, creatorVoice, personality]);

  const isCreator = profileType === "CREATOR" || profileType === "PERSONAL_BRAND";
  const isBusiness = profileType === "BUSINESS" || profileType === "PERSONAL_BRAND";
  const meta = profileMeta[profileType];

  const handleQuickAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthModalError("");
    if (!authEmail.trim() || !authPassword) {
      setAuthModalError("Email and password are required");
      return;
    }
    if (authMode === "register" && !authName.trim()) {
      setAuthModalError("Name is required");
      return;
    }

    setAuthSubmitting(true);
    const res = authMode === "login"
      ? await login(authEmail, authPassword)
      : await register(authName, authEmail, authPassword);
    setAuthSubmitting(false);

    if (res.success) {
      setShowAuthModal(false);
      setError("");
      setSuccess("Successfully signed in! You can now create your workspace.");
    } else {
      setAuthModalError(res.error || "Authentication failed");
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (isCreator && !creatorNiche.trim()) { setError("Creator niche is required for creator mode"); return; }
    setError("");

    if (!isAuthenticated) {
      setError("Please sign in or create an account to create your workspace. Your progress has been saved!");
      setShowAuthModal(true);
      return;
    }

    setLoading(true);

    const payload: Record<string, string> = { name, profileType };
    if (industry) payload.industry = industry;
    if (website) payload.website = website;
    if (description) payload.description = description;
    if (isCreator) {
      if (creatorNiche) payload.creatorNiche = creatorNiche;
      if (contentNiche) payload.contentNiche = contentNiche;
      if (creatorGoals) payload.creatorGoals = creatorGoals;
    }

    const res = await createCompany(payload as never);
    setLoading(false);
    if (!res.success || !res.company) {
      if (res.error === "Unauthorized" || res.error?.toLowerCase().includes("unauthorized") || res.error?.toLowerCase().includes("session")) {
        setError("Your session expired or was unauthorized. Please sign in below to finish creating your workspace — your data is saved!");
        setShowAuthModal(true);
      } else {
        setError(res.error || "Failed to create workspace");
      }
      return;
    }

    const companyId = res.company.id;

    // Business profile
    if (isBusiness) {
      const data: Record<string, string> = {};
      if (businessGoals) data.businessGoals = businessGoals;
      if (productsServices) data.productsServices = productsServices;
      if (location) data.location = location;
      if (targetAudience) data.targetAudience = targetAudience;
      if (brandVoice) data.brandVoice = brandVoice;
      if (brandRestrictions) data.brandRestrictions = brandRestrictions;
      if (Object.keys(data).length) {
        await apiFetch(`/api/companies/${companyId}/profile`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
    }

    // Creator profile
    if (isCreator) {
      const data: Record<string, string> = {};
      if (creatorNiche) data.creatorNiche = creatorNiche;
      if (contentNiche) data.contentNiche = contentNiche;
      if (creatorVoice) data.creatorVoice = creatorVoice;
      if (personality) data.personality = personality;
      if (contentPillars) data.contentPillars = contentPillars;
      if (creatorGoals) data.creatorGoals = creatorGoals;
      if (targetAudience) data.audience = targetAudience;
      if (Object.keys(data).length) {
        await apiFetch(`/api/companies/${companyId}/creator-profile`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
    }

    const memoryContent = profileType === "CREATOR"
      ? `Creator: ${name} | Niche: ${creatorNiche} | Content: ${contentNiche} | Goals: ${creatorGoals}`
      : profileType === "PERSONAL_BRAND"
        ? `Personal Brand: ${name} | Business: ${businessGoals} | Creator niche: ${creatorNiche}`
        : `Company: ${name} | Industry: ${industry} | Goals: ${businessGoals} | Audience: ${targetAudience}`;

    {
      await apiFetch(`/api/companies/${companyId}/memories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "BUSINESS_CONTEXT", content: memoryContent, source: "onboarding", verificationStatus: "VERIFIED", confidence: 0.95 }),
      }).catch(() => {});
    }

    // Clear saved draft once workspace is successfully created
    try { localStorage.removeItem(DRAFT_KEY); } catch {}

    setSuccess("Workspace created! Redirecting...");
    setTimeout(() => router.push("/dashboard"), 1000);
  };

  const steps = ["Identity", isCreator ? "Creator details" : "Business details", "Audience & voice"];

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-app p-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-40 w-2/3 -translate-x-1/2 bg-accent/10 blur-3xl" />
      </div>

      {/* Top bar with session status and login/logout */}
      <div className="absolute right-4 top-4 flex items-center gap-2">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-ink-3 sm:inline">Signed in as <span className="font-medium text-ink-2">{user.email}</span></span>
            <Button variant="ghost" size="sm" onClick={() => logout()} className="gap-2 text-ink-3 hover:text-ink">
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => { setAuthModalError(""); setShowAuthModal(true); }} className="gap-2 border-line-2 text-ink hover:text-ink">
            <LogIn className="h-4 w-4 text-accent" /> Sign In
          </Button>
        )}
      </div>

      <div className="relative w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line-2 bg-surface px-3 py-1 text-xs font-medium text-ink-2">
            <Sparkles className="h-3.5 w-3.5 text-accent" /> {isCreator ? "Creator onboarding" : "Company onboarding"}
          </div>
          <h1 className="h1 text-ink">Set up your workspace</h1>
          <p className="mt-1.5 text-sm text-ink-3">
            We'll build your {meta.blurb} — isolated and verified.
          </p>
        </div>

        {/* Profile selector */}
        <div className="mx-auto mb-8 grid max-w-lg grid-cols-3 gap-2">
          {(Object.keys(profileMeta) as ProfileType[]).map((t) => {
            const m = profileMeta[t];
            const selected = profileType === t;
            return (
              <button
                key={t}
                onClick={() => { setProfileType(t); setError(""); }}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors duration-150",
                  selected
                    ? "border-accent/60 bg-accent-soft text-accent"
                    : "border-line bg-surface text-ink-2 hover:border-line-3"
                )}
              >
                <m.icon className="h-5 w-5" />
                <span className="text-xs font-semibold">{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Steps */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {steps.map((label, i) => {
            const idx = i + 1;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors", step >= idx ? "bg-accent-soft text-accent" : "bg-sunken text-ink-3")}>
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold", step >= idx ? "bg-accent text-white" : "bg-surface")}>{idx}</span>
                  <span className="hidden text-xs font-medium sm:inline">{label}</span>
                </div>
                {idx < steps.length && <div className={cn("h-px w-6", step > idx ? "bg-accent" : "bg-line")} />}
              </div>
            );
          })}
        </div>

        {!authLoading && !isAuthenticated && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-warning-500/25 bg-warning-500/10 px-3.5 py-2.5 text-xs text-warning-600 dark:text-warning-400">
            <span>You are not signed in. Don&apos;t worry — your entries are automatically saved!</span>
            <Button size="sm" variant="outline" onClick={() => { setAuthModalError(""); setShowAuthModal(true); }} className="h-7 text-xs font-semibold border-warning-500/40 text-warning-600 dark:text-warning-400 hover:bg-warning-500/20">
              Sign In
            </Button>
          </div>
        )}

        <Card className="border-line-2">
          <CardContent className="space-y-4 p-5 sm:p-6">
            {error && (
              <div className="space-y-2">
                <Alert tone="danger" message={error} />
                {(error.toLowerCase().includes("unauthorized") || error.toLowerCase().includes("session") || error.toLowerCase().includes("sign in")) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => { setAuthModalError(""); setShowAuthModal(true); }}
                    className="gap-2 border-danger-500/30 text-danger-600 dark:text-danger-400 hover:bg-danger-500/10 text-xs"
                  >
                    <LogIn className="h-3.5 w-3.5" /> Sign in to save & create workspace
                  </Button>
                )}
              </div>
            )}
            {success && <Alert tone="success" message={success} icon={<CheckCircle2 className="h-4 w-4" />} />}

            {step === 1 && (
              <>
                <Field label={isCreator ? "Creator / brand name" : "Company name"} required>
                  <Input placeholder={isCreator ? "e.g. Priyanshu — Tech Creator" : "Acme Corporation"} value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                {isCreator ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Creator niche" required>
                      <Input placeholder="e.g. Tech, Fashion, Finance" value={creatorNiche} onChange={(e) => setCreatorNiche(e.target.value)} />
                    </Field>
                    <Field label="Content niche">
                      <Input placeholder="e.g. Short-form tech reviews" value={contentNiche} onChange={(e) => setContentNiche(e.target.value)} />
                    </Field>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Industry">
                      <Input placeholder="Restaurant, Manufacturing" value={industry} onChange={(e) => setIndustry(e.target.value)} />
                    </Field>
                    <Field label="Website">
                      <Input placeholder="https://example.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
                    </Field>
                  </div>
                )}
                <Field label="Description">
                  <TextArea placeholder={isCreator ? "What content do you create?" : "What does your company do?"} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </Field>
              </>
            )}

            {step === 2 && isBusiness && !isCreator && (
              <>
                <Field label="Business goals">
                  <TextArea placeholder="Increase weekday lunch bookings 20%" value={businessGoals} onChange={(e) => setBusinessGoals(e.target.value)} rows={3} />
                </Field>
                <Field label="Products / services">
                  <TextArea placeholder="Wood-fired pizzas, catering" value={productsServices} onChange={(e) => setProductsServices(e.target.value)} rows={2} />
                </Field>
                <Field label="Location">
                  <Input placeholder="Pune, Maharashtra" value={location} onChange={(e) => setLocation(e.target.value)} />
                </Field>
              </>
            )}

            {step === 2 && isCreator && !isBusiness && (
              <>
                <Field label="Creator goals">
                  <TextArea placeholder="Grow to 100k followers, 3 brand deals per month" value={creatorGoals} onChange={(e) => setCreatorGoals(e.target.value)} rows={3} />
                </Field>
                <Field label="Content pillars (comma separated)">
                  <Input placeholder="e.g. Tech reviews, Tutorials, Behind-scenes" value={contentPillars} onChange={(e) => setContentPillars(e.target.value)} />
                </Field>
                <Field label="Creator voice / personality">
                  <TextArea placeholder="e.g. Energetic, Hinglish, direct hook" value={creatorVoice} onChange={(e) => setCreatorVoice(e.target.value)} rows={2} />
                </Field>
              </>
            )}

            {step === 2 && profileType === "PERSONAL_BRAND" && (
              <>
                <div className="rounded-md border border-warning-500/25 bg-warning-500/10 px-3 py-2 text-xs text-warning-600 dark:text-warning-400">
                  Personal brand combines business + creator signals — fill both below.
                </div>
                <Field label="Business goals">
                  <TextArea placeholder="Business goals..." value={businessGoals} onChange={(e) => setBusinessGoals(e.target.value)} rows={2} />
                </Field>
                <Field label="Creator goals">
                  <TextArea placeholder="Creator goals..." value={creatorGoals} onChange={(e) => setCreatorGoals(e.target.value)} rows={2} />
                </Field>
              </>
            )}

            {step === 3 && (
              <>
                <Field label="Target audience">
                  <TextArea placeholder={isCreator ? "Tech enthusiasts 18–34, Hindi/English" : "Office workers 25–40, families"} value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} rows={3} />
                </Field>
                <Field label={isCreator ? "Creator voice / style" : "Brand voice"}>
                  <TextArea
                    placeholder={isCreator ? "Fast cuts, 2-sec hook, Hinglish" : "Warm, friendly, Hindi + Hinglish"}
                    value={isCreator ? personality : brandVoice}
                    onChange={(e) => isCreator ? setPersonality(e.target.value) : setBrandVoice(e.target.value)}
                    rows={2}
                  />
                </Field>
                {!isCreator && (
                  <Field label="Brand restrictions">
                    <TextArea placeholder="Never use competitor names" value={brandRestrictions} onChange={(e) => setBrandRestrictions(e.target.value)} rows={2} />
                  </Field>
                )}
                <p className="text-xs text-ink-3">
                  After onboarding you can upload PDFs, images and videos — they become verified memories for your {meta.blurb}.
                </p>
              </>
            )}

            <div className="flex items-center justify-between pt-2">
              {step > 1 ? <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button> : <div />}
              {step < 3 ? (
                <Button onClick={() => { setError(""); if (step === 1 && !name.trim()) { setError("Name is required"); return; } setStep(step + 1); }}>
                  Continue <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleCreate} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create {profileType === "CREATOR" ? "Creator" : profileType === "PERSONAL_BRAND" ? "Brand" : ""} Workspace
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Sign-In Modal (keeps onboarding draft safe in place) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-xl border border-line-2 bg-surface p-6 shadow-2xl animate-fade-in-up">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-ink-3 hover:bg-sunken hover:text-ink transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-5">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                <Lock className="h-3 w-3" /> Sign-in Required
              </div>
              <h2 className="text-lg font-bold text-ink">
                {authMode === "login" ? "Sign in to BrainGrow" : "Create BrainGrow Account"}
              </h2>
              <p className="mt-1 text-xs text-ink-3">
                Your workspace details are safely saved. Sign in or register to link and create your workspace.
              </p>
            </div>

            {authModalError && (
              <div className="mb-4">
                <Alert tone="danger" message={authModalError} />
              </div>
            )}

            <form onSubmit={handleQuickAuth} className="space-y-3.5">
              {authMode === "register" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">Your Name</label>
                  <Input
                    placeholder="e.g. Priyanshu"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-2">Email address</label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink-2">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full mt-2" disabled={authSubmitting}>
                {authSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {authMode === "login" ? "Sign In & Continue" : "Create Account & Continue"}
              </Button>
            </form>

            <div className="relative my-3 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-line" /></div>
              <span className="relative bg-surface px-2 text-[11px] text-ink-3">OR</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { window.location.href = "/api/auth/google"; }}
                className="w-full text-xs gap-1.5"
              >
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  setAuthSubmitting(true);
                  const res = await loginWithProvider("Demo");
                  setAuthSubmitting(false);
                  if (res.success) {
                    setShowAuthModal(false);
                    setError("");
                    setSuccess("Signed in! You can now click Create Workspace.");
                  } else {
                    setAuthModalError(res.error || "Demo login failed");
                  }
                }}
                className="w-full text-xs text-accent hover:text-accent font-semibold"
              >
                ⚡ 1-Click Demo
              </Button>
            </div>

            <div className="mt-4 pt-4 border-t border-line text-center text-xs text-ink-3">
              {authMode === "login" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setAuthMode("register"); setAuthModalError(""); }}
                    className="font-semibold text-accent hover:underline"
                  >
                    Create one
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setAuthMode("login"); setAuthModalError(""); }}
                    className="font-semibold text-accent hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="label">
        {label} {required && <span className="text-danger-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 transition-colors focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

function Alert({ tone, message, icon }: { tone: "danger" | "success"; message: string; icon?: React.ReactNode }) {
  return (
    <div className={cn(
      "flex items-start gap-2 rounded-md border p-3 animate-fade-in-up",
      tone === "danger" && "border-danger-500/25 bg-danger-500/10",
      tone === "success" && "border-success-500/25 bg-success-500/10"
    )}>
      {icon || (tone === "danger" && <span className="mt-0.5 h-2 w-2 rounded-full bg-danger-500" />)}
      <p className={cn("text-sm", tone === "danger" && "text-danger-600 dark:text-danger-400", tone === "success" && "text-success-600 dark:text-success-400")}>{message}</p>
    </div>
  );
}
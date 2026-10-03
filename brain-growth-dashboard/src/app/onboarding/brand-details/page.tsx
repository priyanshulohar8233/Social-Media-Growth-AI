"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { OnboardingHeader } from "@/components/onboarding-header";
import { Brain, Building2, User, Loader2, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";

const INDUSTRIES = [
  "Technology",
  "E-commerce",
  "Healthcare",
  "Finance",
  "Education",
  "Marketing",
  "Restaurant",
  "Real Estate",
  "Travel",
  "Entertainment",
  "Other",
];

const CONTENT_TYPES = [
  "Tech Product Reviews",
  "Educational Content",
  "Entertainment",
  "News",
  "Fitness",
  "Travel",
  "Food",
  "Business",
  "Personal Branding",
  "Gaming",
  "Fashion",
  "Other",
];

const GOALS = [
  "Gain Followers",
  "Gain Views",
  "Increase Engagement",
  "Generate Leads",
  "Drive Website Traffic",
  "Gain Users",
  "Increase Brand Awareness",
  "Generate Sales",
  "Build Community",
];

export default function BrandDetailsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [businessType, setBusinessType] = useState<"Individual" | "Company">("Company");
  const [industry, setIndustry] = useState("Technology");
  const [contentType, setContentType] = useState("Tech Product Reviews");
  const [goal, setGoal] = useState("Gain Followers");
  const [website, setWebsite] = useState("");

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Pre-fill existing brand details if already saved
  useEffect(() => {
    apiFetch("/api/brand-details")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data) {
          const b = data.data;
          if (b.businessType) setBusinessType(b.businessType);
          if (b.industry) setIndustry(b.industry);
          if (b.contentType) setContentType(b.contentType);
          if (b.goal) setGoal(b.goal);
          if (b.website) setWebsite(b.website);
        }
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Frontend validations
    if (businessType === "Company" && !industry.trim()) {
      setError("Industry is required for companies.");
      return;
    }
    if (!contentType.trim()) {
      setError("Content Type is required.");
      return;
    }
    if (!goal.trim()) {
      setError("Primary Goal is required.");
      return;
    }
    if (website.trim() && !/^https?:\/\/.+/.test(website.trim())) {
      setError("Website must be a valid URL starting with http:// or https://");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/brand-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType,
          industry: businessType === "Company" ? industry : undefined,
          contentType,
          goal,
          website: website.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess("Brand details saved!");
        setTimeout(() => {
          router.push("/onboarding/tour");
        }, 800);
      } else {
        setError(data.error?.message || "Failed to save brand details.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 bg-background text-foreground flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-accent to-brand-500 flex items-center justify-center text-white shadow-lg shadow-accent/20">
              <Brain className="h-5 w-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight">BrainGrow</span>
          </Link>
          <h1 className="text-2xl font-bold">Set Up Your Brand Details</h1>
          <p className="text-sm text-muted-foreground">
            Tell us about your brand so the AI can craft customized content, strategies, and growth recommendations.
          </p>
        </div>

        <OnboardingHeader currentStep={4} />

        <Card className="border-border bg-card shadow-xl">
          <CardContent className="pt-6">
            {fetching ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="text-sm text-muted-foreground">Loading brand profile...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="flex items-center gap-2.5 p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2.5 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{success}</span>
                  </div>
                )}

                {/* Business Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Business Type *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setBusinessType("Company")}
                      className={`p-3.5 rounded-xl border flex items-center gap-3 text-left transition-all ${
                        businessType === "Company"
                          ? "border-accent bg-accent/10 text-accent font-semibold ring-2 ring-accent/30"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-border/80"
                      }`}
                    >
                      <Building2 className="h-5 w-5 shrink-0" />
                      <div>
                        <div className="text-sm">Company</div>
                        <div className="text-xs font-normal opacity-80">Agency, Startup, Business</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBusinessType("Individual")}
                      className={`p-3.5 rounded-xl border flex items-center gap-3 text-left transition-all ${
                        businessType === "Individual"
                          ? "border-accent bg-accent/10 text-accent font-semibold ring-2 ring-accent/30"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-border/80"
                      }`}
                    >
                      <User className="h-5 w-5 shrink-0" />
                      <div>
                        <div className="text-sm">Individual</div>
                        <div className="text-xs font-normal opacity-80">Creator, Solo Founder, Consultant</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Industry (Visible only for Company) */}
                {businessType === "Company" && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className="text-sm font-medium">Industry *</label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {INDUSTRIES.map((ind) => (
                        <option key={ind} value={ind}>
                          {ind}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Content Type */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">What type of content do you create? *</label>
                  <select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {CONTENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Primary Goal */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">What is your primary goal? *</label>
                  <select
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {GOALS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Website */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Website (Optional)</label>
                  <Input
                    type="url"
                    placeholder="https://example.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your site or portfolio for AI context and brand voice matching.
                  </p>
                </div>

                {/* Navigation Actions */}
                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/onboarding/social-connect")}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Continue to Tour <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

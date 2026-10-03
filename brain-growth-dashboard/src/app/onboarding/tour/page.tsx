"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OnboardingHeader } from "@/components/onboarding-header";
import {
  Brain,
  Sparkles,
  LayoutDashboard,
  Plug,
  Calendar,
  BarChart2,
  Bot,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";

const TOUR_STEPS = [
  {
    icon: LayoutDashboard,
    title: "Welcome to Your Growth Dashboard",
    description:
      "Your central hub for tracking cross-platform reach, content impact, audience engagement, and pipeline ROI in real time.",
    highlight: "Real-time metrics, automated performance scorecards, and next best actions.",
  },
  {
    icon: Brain,
    title: "Company & Brand Brain",
    description:
      "A living memory engine that continuously learns your brand voice, proven hooks, competitive edge, and target audience segments.",
    highlight: "Adaptive intelligence with verified facts, guidelines, and memory verification.",
  },
  {
    icon: Plug,
    title: "Unified Social Accounts",
    description:
      "Manage all your social channels in one place with secure OAuth 2.0 connections across Instagram, YouTube, LinkedIn, X, and more.",
    highlight: "End-to-end token encryption, zero plaintext passwords, and safe analytics retrieval.",
  },
  {
    icon: Calendar,
    title: "Content Creation & Studio",
    description:
      "Generate high-performing hooks, captions, carousels, and video concepts aligned strictly with your brand DNA.",
    highlight: "Content approval workflows, variant A/B tests, and scheduled multi-platform publishing.",
  },
  {
    icon: BarChart2,
    title: "Analytics & Competitor War Room",
    description:
      "Benchmark against competitors, track emerging niche trends, and convert views into tangible subscribers and customers.",
    highlight: "Automated opportunity detection and funnel attribution.",
  },
  {
    icon: Bot,
    title: "Autonomous AI Agents",
    description:
      "Delegate research, monitoring, and draft generation to specialized autonomous agents working 24/7 for your growth.",
    highlight: "Supervised automation with full approval controls.",
  },
];

export default function TourPage() {
  const router = useRouter();
  const { refresh: refreshAuth } = useAuth();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [completing, setCompleting] = useState(false);

  const step = TOUR_STEPS[currentIdx];
  const isLast = currentIdx === TOUR_STEPS.length - 1;

  const completeTour = async () => {
    setCompleting(true);
    try {
      await apiFetch("/api/onboarding/state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "COMPLETED",
          onboardingCompleted: true,
          onboardingTourCompleted: true,
        }),
      });
      await refreshAuth();
      router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    } finally {
      setCompleting(false);
    }
  };

  const nextStep = () => {
    if (isLast) {
      completeTour();
    } else {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const prevStep = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 bg-background text-foreground flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-accent to-brand-500 flex items-center justify-center text-white shadow-lg shadow-accent/20">
              <Brain className="h-5 w-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight">BrainGrow</span>
          </Link>
          <h1 className="text-2xl font-bold">Product Walkthrough</h1>
          <p className="text-sm text-muted-foreground">
            Explore key capabilities of your new AI-powered growth system.
          </p>
        </div>

        <OnboardingHeader currentStep={5} />

        <Card className="border-border bg-card shadow-2xl overflow-hidden relative">
          {/* Top subtle gradient glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          <CardContent className="pt-8 pb-8 px-6 sm:px-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-xl bg-accent/10 border border-accent/20 text-accent flex items-center justify-center">
                <step.icon className="h-6 w-6" />
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                Step {currentIdx + 1} of {TOUR_STEPS.length}
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight">{step.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </div>

            <div className="p-4 rounded-xl bg-accent/5 border border-accent/15 flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/90 font-medium leading-normal">
                {step.highlight}
              </p>
            </div>

            {/* Step navigation buttons */}
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={completeTour}
                disabled={completing}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Skip Tour
              </Button>

              <div className="flex items-center gap-2">
                {currentIdx > 0 && (
                  <Button
                    variant="outline"
                    onClick={prevStep}
                    disabled={completing}
                    size="sm"
                  >
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Previous
                  </Button>
                )}
                <Button onClick={nextStep} disabled={completing} size="sm">
                  {completing ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Finishing...
                    </>
                  ) : isLast ? (
                    <>
                      Finish & Go to Dashboard <CheckCircle2 className="ml-1.5 h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      Next <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

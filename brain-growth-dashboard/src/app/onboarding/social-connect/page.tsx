"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OnboardingHeader } from "@/components/onboarding-header";
import { Brain, CheckCircle2, Loader2, ArrowRight, Plug, AlertCircle, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";

interface SocialAccountItem {
  platform: string;
  platformName: string;
  icon: string;
  connected: boolean;
  accountName: string | null;
  handle: string | null;
  connectedAt: string | null;
  source: string;
  demo: boolean;
}

export default function SocialConnectPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [accounts, setAccounts] = useState<SocialAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Manual credential linking form (one platform at a time)
  const [manualFor, setManualFor] = useState<string | null>(null);
  const [manualHandle, setManualHandle] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/social/accounts");
      const data = await res.json();
      if (res.ok && data.success) {
        setAccounts(data.data.accounts || []);
      }
    } catch {
      setError("Failed to load social accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
    // Check URL parameters for OAuth returns
    const params = new URLSearchParams(window.location.search);
    const conn = params.get("connected");
    const err = params.get("error");
    if (conn) {
      setNotification(`Successfully connected ${conn.charAt(0).toUpperCase() + conn.slice(1)}!`);
      window.history.replaceState({}, "", "/onboarding/social-connect");
    }
    if (err) {
      setError(`OAuth failed: ${err}`);
      window.history.replaceState({}, "", "/onboarding/social-connect");
    }
  }, []);

  const handleConnect = async (platform: string) => {
    setConnecting(platform);
    setError(null);
    setNotification(null);

    try {
      // Initiate OAuth flow
      const res = await apiFetch(`/api/social/connect/${platform}`);
      const data = await res.json();

      if (res.ok && data.data?.authUrl) {
        const authUrl = data.data.authUrl as string;
        if (authUrl.includes("code=dev_")) {
          // Provider OAuth is not configured — redirecting would only create a
          // simulated demo connection, so offer manual linking instead.
          setManualFor(platform);
          setManualError(null);
          setNotification(
            `Real OAuth is not configured for ${platform} yet. Link your account manually below instead — only what you enter is stored.`
          );
          return;
        }
        window.location.href = authUrl;
      } else {
        // No OAuth URL available — fall back to the manual linking form.
        setManualFor(platform);
        setManualError(null);
        setNotification(`OAuth is unavailable for ${platform} right now. Link your account manually below.`);
      }
    } catch {
      setError("Network error while starting OAuth.");
    } finally {
      setConnecting(null);
    }
  };

  const openManual = (platform: string) => {
    setManualFor(platform);
    setManualHandle("");
    setManualName("");
    setManualToken("");
    setManualError(null);
    setError(null);
  };

  const handleManualLink = async (platform: string) => {
    if (!manualHandle.trim()) {
      setManualError("Handle is required to link an account (e.g. @yourhandle).");
      return;
    }
    setManualSaving(true);
    setManualError(null);
    try {
      const res = await apiFetch("/api/social/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          action: "connect",
          handle: manualHandle.trim(),
          displayName: manualName.trim() || undefined,
          accessToken: manualToken.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setNotification(`Linked ${platform} as ${manualHandle.trim()}!`);
        setManualFor(null);
        setManualHandle("");
        setManualName("");
        setManualToken("");
        await loadAccounts();
      } else {
        setManualError(data?.error?.message || `Failed to link ${platform}.`);
      }
    } catch {
      setManualError("Network error while linking account.");
    } finally {
      setManualSaving(false);
    }
  };

  const handleDisconnect = async (platform: string) => {
    setConnecting(platform);
    setError(null);
    try {
      const res = await apiFetch("/api/social/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, action: "disconnect" }),
      });
      if (res.ok) {
        setNotification(`Disconnected ${platform}.`);
        await loadAccounts();
      }
    } catch {
      setError("Failed to disconnect platform.");
    } finally {
      setConnecting(null);
    }
  };

  const handleContinue = async () => {
    // Advance state to BRAND_DETAILS
    await apiFetch("/api/onboarding/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "BRAND_DETAILS" }),
    });
    router.push("/onboarding/brand-details");
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
          <h1 className="text-2xl font-bold">Connect Your Social Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Connect the platforms you use to publish, analyze, and automate your content.
          </p>
        </div>

        <OnboardingHeader currentStep={3} />

        {error && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {notification && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        <Card className="border-border bg-card shadow-xl">
          <CardContent className="pt-6 space-y-4">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="text-sm text-muted-foreground">Loading connected platforms...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {accounts.map((acc) => (
                  <div
                    key={acc.platform}
                    className="p-4 rounded-xl border border-border bg-card hover:border-border/80 flex flex-col justify-between transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{acc.icon}</span>
                        <div>
                          <div className="font-semibold text-sm">{acc.platformName}</div>
                          <div className="text-xs text-muted-foreground">
                            {acc.connected ? acc.handle || "Connected" : "Not connected"}
                          </div>
                        </div>
                      </div>

                      {acc.connected ? (
                        acc.demo ? (
                          <Badge variant="outline" className="flex items-center gap-1 border-warning-500/40 bg-warning-500/10 font-medium text-xs text-warning-600 dark:text-warning-400">
                            Demo
                          </Badge>
                        ) : acc.source === "manual" ? (
                          <Badge className="bg-accent/10 text-accent border-accent/20 flex items-center gap-1 font-medium text-xs">
                            <CheckCircle2 className="w-3 h-3" /> Linked manually
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 flex items-center gap-1 font-medium text-xs">
                            <CheckCircle2 className="w-3 h-3" /> Connected
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-xs">
                          Not Connected
                        </Badge>
                      )}
                    </div>

                    {acc.connected && acc.demo && (
                      <p className="mb-2 text-[11px] text-warning-600 dark:text-warning-400">
                        Demo connection — reconnect with OAuth or link manually once provider keys are configured.
                      </p>
                    )}

                    {/* Manual credential linking form */}
                    {manualFor === acc.platform && !acc.connected && (
                      <div className="mb-2 space-y-2.5 rounded-lg border border-border bg-muted/20 p-3">
                        <p className="text-xs font-medium">Link {acc.platformName} manually</p>
                        {manualError && (
                          <p className="text-xs text-destructive">{manualError}</p>
                        )}
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Handle / username *</label>
                          <input
                            type="text"
                            placeholder="@yourhandle"
                            value={manualHandle}
                            onChange={(e) => setManualHandle(e.target.value)}
                            className="flex h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Display name (optional)</label>
                          <input
                            type="text"
                            placeholder={`${acc.platformName} account`}
                            value={manualName}
                            onChange={(e) => setManualName(e.target.value)}
                            className="flex h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">API token / key (optional)</label>
                          <input
                            type="password"
                            placeholder="Paste a platform API token if you have one"
                            value={manualToken}
                            onChange={(e) => setManualToken(e.target.value)}
                            autoComplete="off"
                            className="flex h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent"
                          />
                          <p className="text-[10px] leading-relaxed text-muted-foreground">
                            Never enter your social media password here — use OAuth, or paste an API token/key
                            the platform issued. Tokens are encrypted before storage and never displayed again.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            disabled={manualSaving}
                            onClick={() => handleManualLink(acc.platform)}
                            className="h-8 px-3.5 text-xs"
                          >
                            {manualSaving ? (
                              <>
                                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Linking...
                              </>
                            ) : (
                              "Save & Link"
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setManualFor(null); setManualError(null); }}
                            className="h-8 px-2.5 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-border/50 flex justify-end gap-2">
                      {acc.connected ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={connecting === acc.platform}
                          onClick={() => handleDisconnect(acc.platform)}
                          className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2.5"
                        >
                          {connecting === acc.platform ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Disconnect"
                          )}
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => (manualFor === acc.platform ? setManualFor(null) : openManual(acc.platform))}
                            className="h-8 px-2.5 text-xs"
                          >
                            {manualFor === acc.platform ? "Hide manual" : "Link manually"}
                          </Button>
                          <Button
                            size="sm"
                            disabled={connecting === acc.platform}
                            onClick={() => handleConnect(acc.platform)}
                            className="text-xs h-8 px-3.5 bg-accent hover:bg-accent/90 text-accent-foreground"
                          >
                            {connecting === acc.platform ? (
                              <>
                                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              `Connect ${acc.platformName}`
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                You can always connect or disconnect accounts later in Settings.
              </span>
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <Button variant="ghost" onClick={handleContinue} className="w-full sm:w-auto">
                  Skip for now
                </Button>
                <Button onClick={handleContinue} className="w-full sm:w-auto">
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

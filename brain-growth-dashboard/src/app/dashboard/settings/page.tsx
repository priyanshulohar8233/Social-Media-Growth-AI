"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { User, Bell, Shield, Plug, Palette, Save, Loader2, Camera, Sparkles, Building2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";

const tabs = [
  { icon: User, label: "Profile" },
  { icon: Building2, label: "Brand Details" },
  { icon: Plug, label: "Social Accounts" },
];

const PLATFORM_LIST = [
  { platform: "instagram", emoji: "📸" },
  { platform: "youtube", emoji: "▶️" },
  { platform: "linkedin", emoji: "💼" },
  { platform: "twitter", emoji: "🐦" },
  { platform: "facebook", emoji: "👥" },
  { platform: "tiktok", emoji: "🎵" },
];

const INDUSTRIES = [
  "Technology", "E-commerce", "Healthcare", "Finance", "Education",
  "Marketing", "Restaurant", "Real Estate", "Travel", "Entertainment", "Other",
];

const CONTENT_TYPES = [
  "Tech Product Reviews", "Educational Content", "Entertainment", "News",
  "Fitness", "Travel", "Food", "Business", "Personal Branding", "Gaming", "Fashion", "Other",
];

const GOALS = [
  "Gain Followers", "Gain Views", "Increase Engagement", "Generate Leads",
  "Drive Website Traffic", "Gain Users", "Increase Brand Awareness", "Generate Sales", "Build Community",
];

export default function SettingsPage() {
  const { user, refresh: refreshAuth } = useAuth();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;
  const [activeTab, setActiveTab] = useState("Profile");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Brand Details State
  const [businessType, setBusinessType] = useState<"Individual" | "Company">("Company");
  const [industry, setIndustry] = useState("Technology");
  const [contentType, setContentType] = useState("Tech Product Reviews");
  const [goal, setGoal] = useState("Gain Followers");
  const [website, setWebsite] = useState("");
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandMsg, setBrandMsg] = useState<string | null>(null);
  const [brandError, setBrandError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<any[]>([]);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded && user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setLoaded(true);
    }
  }, [user, loaded]);

  useEffect(() => {
    if (companyName === "" && currentCompany) setCompanyName(currentCompany.name);
  }, [currentCompany, companyName]);

  useEffect(() => {
    if (!companyId) return;
    apiFetch(`/api/companies/${companyId}/social-accounts`)
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d) => setAccounts(d?.accounts ?? []))
      .catch(() => setAccounts([]));
  }, [companyId]);

  // Load Brand Details
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
      .catch(() => {});
  }, []);

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandSaving(true);
    setBrandMsg(null);
    setBrandError(null);

    if (businessType === "Company" && !industry.trim()) {
      setBrandError("Industry is required for companies.");
      setBrandSaving(false);
      return;
    }

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
        setBrandMsg("Brand details updated successfully!");
      } else {
        setBrandError(data.error?.message || "Failed to save brand details.");
      }
    } catch {
      setBrandError("Network error. Please try again.");
    } finally {
      setBrandSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await apiFetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        await refreshAuth();
        setSaveMsg("Saved successfully");
      } else {
        const j = await res.json().catch(() => ({}));
        setSaveMsg(j.error || "Save failed");
      }
    } catch {
      setSaveMsg("Network error");
    } finally {
      setSaving(false);
    }
  };

  const toggleAccount = async (platform: string, status: string) => {
    if (!companyId) return;
    setToggling(platform);
    try {
      const res = await apiFetch(`/api/companies/${companyId}/social-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, action: status === "connected" ? "disconnect" : "connect" }),
      });
      if (res.ok) {
        const d = await apiFetch(`/api/companies/${companyId}/social-accounts`).then((r) => (r.ok ? r.json() : null));
        setAccounts(d?.accounts ?? []);
      }
    } catch {
      // noop
    } finally {
      setToggling(null);
    }
  };

  // Merge known platforms with DB state
  const connectedAccounts = PLATFORM_LIST.map(({ platform, emoji }) => {
    const db = accounts.find((a) => a.platform === platform);
    return {
      name: platform.charAt(0).toUpperCase() + platform.slice(1),
      platform,
      handle: db?.handle ?? "Not connected",
      connected: db ? db.status === "connected" : false,
      emoji,
      followers: db?.followers ?? 0,
    };
  });

  const initials = (user?.name || "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account and workspace preferences." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="space-y-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.label;
            return (
              <button
                key={tab.label}
                onClick={() => setActiveTab(tab.label)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                  active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-sunken"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-4 lg:col-span-3">
          {activeTab === "Profile" && (
            <>
              <Card>
                <div className="border-b border-line-2 p-5">
                  <h2 className="h3 text-ink">Profile</h2>
                  <p className="mt-0.5 text-xs text-ink-3">Update your personal information</p>
                </div>
                <div className="space-y-4 p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sunken text-lg font-bold text-ink-2">{initials}</div>
                    <Button variant="outline" size="sm"><Camera className="mr-1.5 h-3.5 w-3.5" /> Change photo</Button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
                    <Field label="Email"><Input value={email} type="email" disabled /></Field>
                    <Field label="Company"><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></Field>
                    <Field label="Timezone"><Input defaultValue="UTC+5:30 (IST)" /></Field>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                      {saving ? "Saving…" : "Save changes"}
                    </Button>
                    {saveMsg && <span className="text-xs text-ink-2">{saveMsg}</span>}
                  </div>
                </div>
              </Card>
            </>
          )}

          {activeTab === "Brand Details" && (
            <Card>
              <div className="border-b border-line-2 p-5">
                <h2 className="h3 text-ink">Brand Details</h2>
                <p className="mt-0.5 text-xs text-ink-3">
                  Configure your brand type, target goals, content strategy, and industry focus.
                </p>
              </div>

              <form onSubmit={handleSaveBrand} className="space-y-4 p-5">
                {brandError && (
                  <div className="flex items-center gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{brandError}</span>
                  </div>
                )}
                {brandMsg && (
                  <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{brandMsg}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="label">Business Type *</label>
                  <div className="grid grid-cols-2 gap-3 max-w-md">
                    <button
                      type="button"
                      onClick={() => setBusinessType("Company")}
                      className={`p-3 rounded-lg border text-sm font-medium flex items-center gap-2.5 transition-all ${
                        businessType === "Company"
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-line bg-surface text-ink-2 hover:bg-sunken"
                      }`}
                    >
                      <Building2 className="h-4 w-4" /> Company
                    </button>
                    <button
                      type="button"
                      onClick={() => setBusinessType("Individual")}
                      className={`p-3 rounded-lg border text-sm font-medium flex items-center gap-2.5 transition-all ${
                        businessType === "Individual"
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-line bg-surface text-ink-2 hover:bg-sunken"
                      }`}
                    >
                      <User className="h-4 w-4" /> Individual
                    </button>
                  </div>
                </div>

                {businessType === "Company" && (
                  <Field label="Industry *">
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:border-accent"
                    >
                      {INDUSTRIES.map((ind) => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </Field>
                )}

                <Field label="Content Type *">
                  <select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:border-accent"
                  >
                    {CONTENT_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Primary Goal *">
                  <select
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:border-accent"
                  >
                    {GOALS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Website (Optional)">
                  <Input
                    type="url"
                    placeholder="https://example.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </Field>

                <div className="pt-2">
                  <Button type="submit" disabled={brandSaving}>
                    {brandSaving ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-1.5 h-4 w-4" /> Save Brand Details
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {activeTab === "Social Accounts" && (
            <Card>
              <div className="flex items-center justify-between border-b border-line-2 p-5">
                <div>
                  <h2 className="h3 text-ink">Connected Accounts</h2>
                  <p className="mt-0.5 text-xs text-ink-3">Manage and link your official social media channels</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href="/onboarding/social-connect">
                    <Plug className="mr-1.5 h-3.5 w-3.5" /> Reconnect Accounts
                  </a>
                </Button>
              </div>
              <div className="space-y-2 p-5">
                {connectedAccounts.map((account) => (
                  <div key={account.platform} className="flex items-center justify-between rounded-md border border-line-2 p-3.5">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{account.emoji}</span>
                      <div>
                        <p className="text-sm font-medium text-ink">{account.name}</p>
                        <p className="text-xs text-ink-3">{account.handle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.connected && <Badge variant="success">Connected</Badge>}
                      <Button
                        variant={account.connected ? "outline" : "default"}
                        size="sm"
                        disabled={toggling === account.platform}
                        onClick={() => toggleAccount(account.platform, account.connected ? "connected" : "disconnected")}
                      >
                        {toggling === account.platform ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : account.connected ? (
                          "Disconnect"
                        ) : (
                          "Connect"
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
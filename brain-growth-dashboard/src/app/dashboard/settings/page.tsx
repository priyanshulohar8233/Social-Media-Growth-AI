"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { User, Bell, Shield, Plug, Palette, Save, Loader2, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";

const tabs = [
  { icon: User, label: "Profile" },
  { icon: Plug, label: "Integrations" },
];

const PLATFORM_META: Record<string, { handle: string; emoji: string; connected: boolean }> = {
  instagram: { handle: "@braingrow_hq", emoji: "📸", connected: true },
  youtube: { handle: "BrainGrow HQ", emoji: "▶️", connected: true },
  linkedin: { handle: "BrainGrow Inc.", emoji: "💼", connected: true },
  twitter: { handle: "@braingrow", emoji: "🐦", connected: true },
  facebook: { handle: "BrainGrow", emoji: "👥", connected: false },
  tiktok: { handle: "@braingrow", emoji: "🎵", connected: false },
};

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
  const connectedAccounts = PLATFORM_META
    ? Object.entries(PLATFORM_META).map(([platform, meta]) => {
        const db = accounts.find((a) => a.platform === platform);
        return {
          name: platform.charAt(0).toUpperCase() + platform.slice(1),
          platform,
          handle: db?.handle ?? meta.handle,
          connected: db ? db.status === "connected" : meta.connected,
          emoji: meta.emoji,
          followers: db?.followers ?? 0,
        };
      })
    : [];

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

          {activeTab === "Integrations" && (
            <Card>
              <div className="border-b border-line-2 p-5">
                <h2 className="h3 text-ink">Connected accounts</h2>
                <p className="mt-0.5 text-xs text-ink-3">Manage your linked social media accounts</p>
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
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  Loader2,
  Eye,
  EyeOff,
  KeyRound,
  ExternalLink,
  ChevronDown,
  CheckCircle2,
  Plug,
  Unplug,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";

interface PlatformMeta {
  name: string;
  emoji: string;
  color: string;
  keyLabel: string;
  guide: { title: string; steps: string[]; url: string };
}

const PLATFORMS: PlatformMeta[] = [
  {
    name: "Instagram",
    emoji: "📸",
    color: "from-pink-500 to-purple-600",
    keyLabel: "Instagram Graph API access token",
    guide: {
      title: "Instagram API key kaise milegi",
      steps: [
        "developers.facebook.com par jao aur Meta Developer account banao (free)",
        "Naya app banao aur 'Instagram Graph API' product add karo",
        "Apna Instagram Business/Creator account connect karo",
        "'Generate Token' button se long-lived access token banao",
        "Us token ko yahan paste karke Connect dabao",
      ],
      url: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login",
    },
  },
  {
    name: "YouTube",
    emoji: "▶️",
    color: "from-red-500 to-red-700",
    keyLabel: "YouTube Data API v3 key",
    guide: {
      title: "YouTube API key kaise milegi",
      steps: [
        "console.cloud.google.com par jao aur Google account se login karo",
        "Naya project banao (ya existing select karo)",
        "Library mein jao aur 'YouTube Data API v3' enable karo",
        "'Credentials' → 'Create credentials' → 'API key' par click karo",
        "Bani hui API key copy karke yahan paste karo",
      ],
      url: "https://developers.google.com/youtube/v3/getting-started",
    },
  },
  {
    name: "LinkedIn",
    emoji: "💼",
    color: "from-blue-600 to-blue-800",
    keyLabel: "LinkedIn access token",
    guide: {
      title: "LinkedIn API key kaise milegi",
      steps: [
        "developer.linkedin.com par jao aur LinkedIn account se login karo",
        "'Create app' par click karke naya app banao",
        "App mein 'Products' → 'Sign In with LinkedIn' add karo",
        "Auth tab se 'Access Token' generate karo (r_liteprofile, w_member_social scopes)",
        "Token copy karke yahan paste karo",
      ],
      url: "https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin",
    },
  },
  {
    name: "Twitter / X",
    emoji: "🐦",
    color: "from-sky-500 to-sky-700",
    keyLabel: "X API Bearer Token",
    guide: {
      title: "X (Twitter) API key kaise milegi",
      steps: [
        "developer.x.com par jao aur X account se login karo",
        "'Create App' karke naya app banao (free tier kaafi hai)",
        "App ke 'Keys and tokens' section mein jao",
        "'Bearer Token' copy karo (ya API Key + Secret se banao)",
        "Bearer Token yahan paste karke Connect dabao",
      ],
      url: "https://developer.x.com/en/docs/twitter-api/getting-started/getting-access-to-the-twitter-api",
    },
  },
  {
    name: "Facebook",
    emoji: "👥",
    color: "from-blue-500 to-blue-700",
    keyLabel: "Facebook Page access token",
    guide: {
      title: "Facebook API key kaise milegi",
      steps: [
        "developers.facebook.com par jao aur Meta Developer account banao",
        "Naya app banao aur 'Facebook Login' + 'Pages API' add karo",
        "'Tools' → 'Graph API Explorer' mein jao",
        "Apna Page select karo aur 'Generate Access Token' dabao",
        "Page access token copy karke yahan paste karo",
      ],
      url: "https://developers.facebook.com/docs/pages-api",
    },
  },
  {
    name: "TikTok",
    emoji: "🎵",
    color: "from-black to-gray-800",
    keyLabel: "TikTok access token",
    guide: {
      title: "TikTok API key kaise milegi",
      steps: [
        "developers.tiktok.com par jao aur TikTok account se login karo",
        "'Create App' karke naya app banao",
        "App ke 'Manage' section se Client Key aur Client Secret milenge",
        "Inse 'Access Token' generate karo (ya sandbox token use karo)",
        "Access token yahan paste karke Connect dabao",
      ],
      url: "https://developers.tiktok.com/doc/getting-started",
    },
  },
  {
    name: "Pinterest",
    emoji: "📌",
    color: "from-red-500 to-red-600",
    keyLabel: "Pinterest access token",
    guide: {
      title: "Pinterest API key kaise milegi",
      steps: [
        "developers.pinterest.com par jao aur Pinterest account se login karo",
        "'Create app' karke naya app banao",
        "App dashboard se 'Access Token' generate karo",
        "Token copy karke yahan paste karo",
      ],
      url: "https://developers.pinterest.com/docs/getting-started/introduction/",
    },
  },
  {
    name: "Threads",
    emoji: "🧵",
    color: "from-zinc-600 to-zinc-800",
    keyLabel: "Threads API access token",
    guide: {
      title: "Threads API key kaise milegi",
      steps: [
        "developers.facebook.com par jao aur Meta Developer account banao",
        "Naya app banao aur 'Threads API' product add karo",
        "Apna Threads account connect karo",
        "Access token generate karke yahan paste karo",
      ],
      url: "https://developers.facebook.com/docs/threads",
    },
  },
];

interface Account {
  id: string;
  platform: string;
  handle: string;
  displayName: string | null;
  status: string;
  followers: number;
  hasKey: boolean;
}

export default function ConnectionsPage() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [openGuide, setOpenGuide] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<Record<string, { handle: string; apiKey: string }>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/companies/${companyId}/social-accounts`);
      const d = res.ok ? await res.json() : null;
      setAccounts(d?.accounts ?? []);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const accountFor = (platform: string) => {
    const list = accounts.filter((a) => a.platform === platform);
    return list.find((a) => a.status === "connected") || list[0];
  };

  const connect = async (platform: string) => {
    if (!companyId) return;
    setBusy(platform);
    setMsg((m) => ({ ...m, [platform]: "" }));
    const f = form[platform] || { handle: "", apiKey: "" };
    try {
      const res = await apiFetch(`/api/companies/${companyId}/social-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          handle: f.handle.trim() || undefined,
          apiKey: f.apiKey.trim() || undefined,
          action: "connect",
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg((m) => ({ ...m, [platform]: "✅ Connected! API key saved." }));
        await load();
      } else {
        setMsg((m) => ({ ...m, [platform]: `❌ ${d.error || "Failed"}` }));
      }
    } catch {
      setMsg((m) => ({ ...m, [platform]: "❌ Network error" }));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (platform: string) => {
    if (!companyId) return;
    setBusy(platform);
    try {
      await apiFetch(`/api/companies/${companyId}/social-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, action: "disconnect" }),
      });
      await load();
    } catch {
      // noop
    } finally {
      setBusy(null);
    }
  };

  const setField = (platform: string, key: "handle" | "apiKey", value: string) => {
    setForm((f) => ({ ...f, [platform]: { ...(f[platform] || { handle: "", apiKey: "" }), [key]: value } }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connections"
        description="Connect your social media accounts and add API keys so BrainGrow can post and read performance for you."
      />

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-accent/20 bg-accent-soft/50 p-4 text-sm text-ink-2">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <p>
          Har platform ke liye <span className="font-medium text-ink">API key</span> chahiye hoti hai taaki BrainGrow
          aapke account se connect ho sake. Neeche har platform ke card mein{" "}
          <span className="font-medium text-ink">"API key kaise milegi"</span> guide di gayi hai — usse follow karke key
          banao aur yahan paste karo.
        </p>
      </div>

      {/* Platform cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {PLATFORMS.map((p) => {
          const acc = accountFor(p.name.toLowerCase());
          const connected = acc?.status === "connected";
          const hasKey = acc?.hasKey ?? false;
          const f = form[p.name.toLowerCase()] || { handle: "", apiKey: "" };
          const isBusy = busy === p.name.toLowerCase();
          const guideOpen = openGuide === p.name.toLowerCase();
          return (
            <Card key={p.name} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line-2 p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-lg text-white shadow-sm",
                      p.color
                    )}
                  >
                    {p.emoji}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">{p.name}</p>
                    <p className="text-xs text-ink-3">{acc?.handle || "Not connected"}</p>
                  </div>
                </div>
                {connected ? (
                  <Badge variant="success">
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </Badge>
                ) : (
                  <Badge variant="neutral">Not connected</Badge>
                )}
              </div>

              <div className="space-y-3 p-4">
                <div className="space-y-1.5">
                  <label className="label">Handle / Channel name</label>
                  <Input
                    placeholder={`e.g. @your${p.name.toLowerCase()}`}
                    value={f.handle}
                    onChange={(e) => setField(p.name.toLowerCase(), "handle", e.target.value)}
                    disabled={connected}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="label">{p.keyLabel}</label>
                  <div className="relative">
                    <Input
                      type={showKey[p.name.toLowerCase()] ? "text" : "password"}
                      placeholder="Paste your API key / token here"
                      value={f.apiKey}
                      onChange={(e) => setField(p.name.toLowerCase(), "apiKey", e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((s) => ({ ...s, [p.name.toLowerCase()]: !s[p.name.toLowerCase()] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink"
                      aria-label={showKey[p.name.toLowerCase()] ? "Hide key" : "Show key"}
                    >
                      {showKey[p.name.toLowerCase()] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {hasKey && connected && (
                    <p className="text-[11px] text-success-600 dark:text-success-400">✓ API key saved</p>
                  )}
                </div>

                {msg[p.name.toLowerCase()] && (
                  <p className="text-xs text-ink-2">{msg[p.name.toLowerCase()]}</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {connected ? (
                    <Button variant="outline" size="sm" onClick={() => disconnect(p.name.toLowerCase())} disabled={isBusy}>
                      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                      Disconnect
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => connect(p.name.toLowerCase())} disabled={isBusy}>
                      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                      Connect
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenGuide(guideOpen ? null : p.name.toLowerCase())}
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    API key kaise milegi
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", guideOpen && "rotate-180")} />
                  </button>
                </div>

                {guideOpen && (
                  <div className="rounded-lg border border-line-2 bg-sunken/50 p-3.5">
                    <p className="mb-2 text-xs font-semibold text-ink">{p.guide.title}</p>
                    <ol className="space-y-1.5">
                      {p.guide.steps.map((s, i) => (
                        <li key={i} className="flex gap-2 text-xs text-ink-2">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-bold text-accent">
                            {i + 1}
                          </span>
                          {s}
                        </li>
                      ))}
                    </ol>
                    <a
                      href={p.guide.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                    >
                      Official guide kholo <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-3">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading connections…
        </div>
      )}
    </div>
  );
}
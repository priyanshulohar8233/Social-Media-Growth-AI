"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";
import { Loader2, Sparkles, Save, Copy, Check, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const PLATFORMS = ["instagram", "tiktok", "youtube", "linkedin", "twitter", "facebook"] as const;
const CONTENT_TYPES = ["post", "reel", "carousel", "story", "video", "thread", "article"] as const;
const TONES = ["professional", "playful", "bold", "empathetic", "authoritative"] as const;

interface Score {
  label: string;
  value: number;
  note: string;
}

/**
 * Deterministic quality analysis of a generated post. Real heuristic metrics —
 * not a hallucinated number. Evaluate: length fit, hook, CTA, structure, engagement signals.
 */
function scoreGenerated(text: string, platform: (typeof PLATFORMS)[number]): { overall: number; factors: Score[] } {
  const factors: Score[] = [];
  const clean = text.trim();
  const lines = clean.split(/\n+/).filter((l) => l.trim().length > 0);
  const words = clean.split(/\s+/).filter(Boolean).length;

  // 1. Length fit per platform
  const ideal = { instagram: 40, tiktok: 30, youtube: 60, linkedin: 90, twitter: 25, facebook: 50 }[platform] ?? 40;
  const lengthScore = Math.max(0, Math.min(1, 1 - Math.abs(words - ideal) / (ideal * 1.2)));
  factors.push({ label: "Length fit", value: lengthScore, note: `${words} words (ideal ~${ideal})` });

  // 2. Hook — first line short & punchy
  const firstLine = lines[0] || "";
  const hookScore = firstLine.length <= 65 && firstLine.length > 0 ? 1 : 0.4;
  factors.push({ label: "Hook", value: hookScore, note: firstLine.slice(0, 40) || "missing" });

  // 3. CTA — closing line contains a directive
  const ctaWords = ["follow", "share", "comment", "save", "check", "link", "sign up", "dm", "message", "subscribe", "repo", "try", "download"];
  const last = lines[lines.length - 1] || "";
  const hasCta = ctaWords.some((w) => last.toLowerCase().includes(w));
  factors.push({ label: "CTA", value: hasCta ? 1 : 0.3, note: hasCta ? "closing call-to-action detected" : "no CTA in last line" });

  // 4. Structure — several short lines / paragraphs
  const structureScore = Math.min(1, lines.length / 4);
  factors.push({ label: "Structure", value: structureScore, note: `${lines.length} line(s)` });

  // 5. Engagement signals
  const engagement = (text.match(/\?/g)?.length || 0) + (text.match(/#/g)?.length || 0) + (text.match(/[\u{1F300}-\u{1FAFF}]/gu)?.length || 0);
  const engagementScore = Math.min(1, engagement / 3);
  factors.push({ label: "Engagement signals", value: engagementScore, note: `${engagement} signal(s)` });

  const overall = Math.round((factors.reduce((s, f) => s + f.value, 0) / factors.length) * 100);
  return { overall, factors };
}

const scoreColor = (n: number) => (n >= 80 ? "text-success-600" : n >= 60 ? "text-warning-600" : "text-danger-500");

export function AiGenerator() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("instagram");
  const [type, setType] = useState<(typeof CONTENT_TYPES)[number]>("post");
  const [tone, setTone] = useState<(typeof TONES)[number]>("professional");
  const [audience, setAudience] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [score, setScore] = useState<{ overall: number; factors: Score[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const generate = async () => {
    if (!companyId || !topic.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setScore(null);
    setSavedMsg(null);
    try {
      const prompt = `Create a ${tone} ${type} for ${platform} about: ${topic}${audience ? `\nTarget audience: ${audience}` : ""}.\nInclude a strong hook line, clear body with line breaks, and a call to action in the last line.`;
      const res = await apiFetch(`/api/companies/${companyId}/generation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "TEXT", prompt }),
      });
      const data = await res.json();
      const text: string = data.job?.output || data.job?.error || data.error || "";
      setResult(text);
      setScore(scoreGenerated(text, platform));
    } catch {
      setResult("Sorry — generation failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const saveToContent = async () => {
    if (!companyId || !result) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/companies/${companyId}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: topic.trim().slice(0, 200),
          body: result,
          hook: result.split(/\n+/)[0]?.slice(0, 500) || undefined,
          platform,
          contentType: type,
        }),
      });
      const data = await res.json();
      setSavedMsg(res.ok ? `Saved to content library${data.content?.id ? ` (${data.content.id})` : ""}.` : data.error || "Save failed.");
    } catch {
      setSavedMsg("Save failed — network error.");
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Inputs */}
      <Card className="h-fit p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-accent"><Sparkles className="h-4 w-4" /></span>
          <h3 className="h3 text-ink">Content generator</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-2">Topic</label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. 5 healthy breakfast ideas" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ink-2">Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent">
                {PLATFORMS.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-2">Content type</label>
              <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent">
                {CONTENT_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ink-2">Tone</label>
              <select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent">
                {TONES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-2">Audience (optional)</label>
              <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="busy professionals" className="mt-1" />
            </div>
          </div>
          <Button onClick={generate} disabled={loading || !topic.trim()} className="w-full">
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            {loading ? "Generating…" : "Generate content"}
          </Button>
        </div>
      </Card>

      {/* Output */}
      <Card className="flex min-h-[320px] flex-col p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="h3 text-ink">Output</h3>
          {result && score && (
            <span className={cn("text-sm font-bold", scoreColor(score.overall))}>Quality {score.overall}/100</span>
          )}
        </div>

        {!result && !loading && <p className="flex flex-1 items-center justify-center text-sm text-ink-3">Generated copy and its quality analysis will appear here.</p>}
        {loading && <div className="flex flex-1 items-center justify-center text-sm text-ink-3"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</div>}

        {result && (
          <>
            <div className="flex-1 overflow-y-auto rounded-lg border border-line bg-surface p-4 text-sm text-ink whitespace-pre-wrap">{result}</div>

            {score && (
              <div className="mt-3 space-y-1.5">
                {score.factors.map((f) => (
                  <div key={f.label} className="flex items-center gap-2 text-[11px]">
                    <span className="w-32 shrink-0 text-ink-2">{f.label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                      <div className={cn("h-full rounded-full", f.value >= 0.8 ? "bg-success-500" : f.value >= 0.5 ? "bg-warning-500" : "bg-danger-500")} style={{ width: `${f.value * 100}%` }} />
                    </div>
                    <span className="w-40 shrink-0 truncate text-right text-ink-3">{f.note}</span>
                  </div>
                ))}
                <p className="pt-1 text-[10px] text-ink-3">Score is a deterministic analysis of the copy (length, hook, CTA, structure, engagement signals).</p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copy}>{copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}{copied ? "Copied" : "Copy"}</Button>
              <Button size="sm" onClick={saveToContent} disabled={saving}>
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Save to content library
              </Button>
              {savedMsg && <span className="flex items-center gap-1 text-xs text-success-600"><FileText className="h-3.5 w-3.5" /> {savedMsg}</span>}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";
import { Loader2, Plus, Swords, ExternalLink, Trash2, ShieldAlert, Radar, TrendingUp, BrainCircuit, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Competitor {
  id: string;
  name: string;
  handle: string | null;
  platform: string | null;
  website: string | null;
  notes: string | null;
  createdAt: string;
}

interface WarCompetitor {
  id: string;
  name: string;
  handle: string | null;
  platform: string | null;
  website: string | null;
  threatScore: number;
  threatLabel: "Low" | "Moderate" | "High" | "Critical";
  strengths: string[];
  weaknesses: string[];
  gaps: string[];
  counterStrategies: string[];
  battlecard: string[];
  whyWinning: string;
  whyWinningProvider: string;
  observationCount: number;
  recentObservations: Array<{ content: string; createdAt: string }>;
  dataSufficient: boolean;
}

interface WarReport {
  competitors: WarCompetitor[];
  generatedAt: string;
  analyzeModel: string | null;
  analyzeProvider: string | null;
  totalCompetitors: number;
  avgThreat: number;
  topGapTopics: string[];
}

const THREAT_TONE: Record<string, string> = {
  Low: "text-success-600 dark:text-success-400",
  Moderate: "text-warning-600 dark:text-warning-400",
  High: "text-danger-500",
  Critical: "text-danger-500",
};

export default function CompetitorsPage() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);

  const [war, setWar] = useState<WarReport | null>(null);
  const [warLoading, setWarLoading] = useState(true);

  const loadWar = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await apiFetch(`/api/companies/${companyId}/competitors/war-room`);
      if (res.ok) setWar(await res.json());
    } finally {
      setWarLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadWar();
  }, [loadWar]);

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await apiFetch(`/api/companies/${companyId}/competitors`);
      if (res.ok) {
        const data = await res.json();
        setCompetitors(data.competitors || []);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!companyId || !name.trim()) return;
    setAdding(true);
    try {
      const res = await apiFetch(`/api/companies/${companyId}/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), handle: handle.trim() || undefined, platform: platform.trim() || undefined, website: website.trim() || undefined, notes: notes.trim() || undefined }),
      });
      if (res.ok) {
        setName(""); setHandle(""); setPlatform(""); setWebsite(""); setNotes("");
        load();
        loadWar();
      }
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    if (!companyId) return;
    await apiFetch(`/api/companies/${companyId}/competitors/${id}`, { method: "DELETE" });
    load();
    loadWar();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Competitor war room" description="Track competitors you're watching — adding one records an observation in your brain." />

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Swords className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-ink">Track a competitor</h3>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Competitor name" />
          <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" aria-label="Handle" />
          <Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Platform" aria-label="Platform" />
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website" aria-label="Website" />
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={3} className="sm:col-span-2 lg:col-span-2" aria-label="Notes" />
        </div>
        <div className="mt-2">
          <Button onClick={add} disabled={adding || !name.trim()}>
            {adding ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />} Add competitor
          </Button>
        </div>
      </Card>

      {loading && <Card className="flex items-center justify-center p-10 text-ink-3"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</Card>}
      {!loading && competitors.length === 0 && <Card className="p-10 text-center text-sm text-ink-3">No tracked competitors yet.</Card>}

      {!loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {competitors.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{c.name}</p>
                  <p className="text-[11px] text-ink-3">
                    {[c.handle && `@${c.handle}`, c.platform, c.website].filter(Boolean).join(" · ") || "No details"}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-ink-3 hover:text-danger-500" onClick={() => remove(c.id)} aria-label="Remove competitor">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {c.notes && <p className="mt-2 text-xs text-ink-2">{c.notes}</p>}
              {c.website && (
                <a href={c.website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
                  Visit site <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* War Room intelligence */}
      <div className="pt-2">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-danger-500/10 text-danger-500"><ShieldAlert className="h-4 w-4" /></span>
            <div>
              <h3 className="h3 text-ink">War room analysis</h3>
              <p className="text-xs text-ink-3">Threat scoring derived from real observations + patterns. Narratives come from the AI gateway when providers are configured; otherwise labeled deterministic summaries.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadWar} className="shrink-0">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {warLoading && <Card className="flex items-center justify-center p-10 text-ink-3"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing competitors…</Card>}

        {!warLoading && war && war.competitors.length === 0 && (
          <Card className="p-10 text-center text-sm text-ink-3">Add competitors to start gathering intelligence.</Card>
        )}

        {!warLoading && war && war.competitors.length > 0 && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Card className="p-4">
                <p className="caption text-ink-3">Tracked</p>
                <p className="metric text-ink">{war.totalCompetitors}</p>
              </Card>
              <Card className="p-4">
                <p className="caption text-ink-3">Avg threat</p>
                <p className="metric text-ink">{war.avgThreat}<span className="text-sm text-ink-3">/100</span></p>
              </Card>
              <Card className="p-4 lg:col-span-2">
                <p className="caption flex items-center gap-1 text-ink-3"><Radar className="h-3 w-3" /> Exposed gaps (we under-cover)</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {war.topGapTopics.length
                    ? war.topGapTopics.map((t) => <span key={t} className="rounded bg-warning-500/10 px-1.5 py-0.5 text-[10px] font-medium text-warning-600 dark:text-warning-400">{t}</span>)
                    : <span className="text-xs text-ink-3">None detected yet</span>}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {war.competitors.map((c) => {
                const threatPct = Math.min(100, c.threatScore);
                return (
                  <Card key={c.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-2 p-4">
                      <div className="flex items-center gap-2">
                        <BrainCircuit className="h-4 w-4 text-accent" />
                        <h4 className="text-sm font-semibold text-ink">{c.name}</h4>
                        {c.handle && <span className="text-xs text-ink-3">@{c.handle}</span>}
                        {c.platform && <span className="text-xs text-ink-3">{c.platform}</span>}
                        <span className="text-[10px] text-ink-3">{c.observationCount} observations</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-bold tabular-nums", THREAT_TONE[c.threatLabel])}>{c.threatLabel} threat · {c.threatScore}/100</span>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-sunken">
                          <div className={cn("h-full rounded-full", c.threatScore >= 55 ? "bg-danger-500" : c.threatScore >= 38 ? "bg-warning-500" : "bg-success-500")} style={{ width: `${threatPct}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
                      <div className="space-y-3">
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Why they might be winning</p>
                          <p className="text-sm text-ink">{c.whyWinning}</p>
                          {c.whyWinningProvider !== "deterministic" && c.whyWinningProvider !== "n/a" && (
                            <p className="mt-0.5 text-[10px] text-ink-3">analyzed with {c.whyWinningProvider}</p>
                          )}
                        </div>
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Battlecard</p>
                          <ul className="space-y-1">
                            {c.battlecard.map((line) => <li key={line} className="flex items-start gap-1.5 text-xs text-ink-2"><span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-ink-3" />{line}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Counter strategy (differentiate — never copy)</p>
                          <ul className="space-y-1">
                            {c.counterStrategies.map((s) => <li key={s} className="flex items-start gap-1.5 text-xs text-ink-2"><span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-accent" />{s}</li>)}
                          </ul>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-md border border-line-2 bg-surface p-3">
                            <p className="mb-1 text-[11px] font-semibold text-success-600 dark:text-success-400">Strengths</p>
                            <ul className="space-y-1">
                              {c.strengths.map((s) => <li key={s} className="text-xs text-ink-2">{s}</li>)}
                            </ul>
                          </div>
                          <div className="rounded-md border border-line-2 bg-surface p-3">
                            <p className="mb-1 text-[11px] font-semibold text-danger-500">Weaknesses / gaps</p>
                            <ul className="space-y-1">
                              {c.weaknesses.map((s) => <li key={s} className="text-xs text-ink-2">{s}</li>)}
                            </ul>
                          </div>
                        </div>
                        {c.gaps.length > 0 && (
                          <div>
                            <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3"><TrendingUp className="h-3 w-3" /> Topics they own that we don&apos;t</p>
                            <div className="flex flex-wrap gap-1.5">
                              {c.gaps.map((g) => <span key={g} className="rounded bg-warning-500/10 px-1.5 py-0.5 text-[10px] font-medium text-warning-600 dark:text-warning-400">{g}</span>)}
                            </div>
                          </div>
                        )}
                        {c.recentObservations.length > 0 && (
                          <div>
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Recent moves</p>
                            <ul className="space-y-1">
                              {c.recentObservations.map((o, i) => (
                                <li key={i} className="flex items-start justify-between gap-2 text-xs text-ink-2">
                                  <span>{o.content}</span>
                                  <span className="shrink-0 text-[10px] text-ink-3">{new Date(o.createdAt).toLocaleDateString()}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
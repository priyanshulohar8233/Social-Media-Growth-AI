"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";
import { Loader2, Plus, CheckCircle2, XCircle, Trash2, Brain, Filter, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const INSIGHT_STATUS = ["CANDIDATE", "VALIDATED", "ACTIVE", "STALE", "REJECTED", "SUPERSEDED"] as const;
type InsightType = "FACT" | "OBSERVATION" | "INFERENCE" | "PREDICTION";
type InsightStatus = (typeof INSIGHT_STATUS)[number];

interface Insight {
  id: string;
  type: InsightType;
  content: string;
  confidence: number;
  evidenceCount: number;
  sampleSize: number;
  source: string | null;
  status: InsightStatus;
  entityKind: string | null;
  entityId: string | null;
  createdAt: string;
  lastReinforcedAt: string;
}

interface NextAction {
  id: string;
  title: string;
  reasoning: string;
  evidence: { confidence: number; evidenceCount: number; sampleSize: number; insightType: string };
  expectedImpact: number;
  priorityScore: number;
}

const INSIGHT_STATUS_STYLE: Record<InsightStatus, string> = {
  CANDIDATE: "bg-sunken text-ink-2",
  VALIDATED: "bg-info-500/15 text-info-600",
  ACTIVE: "bg-success-500/15 text-success-600",
  STALE: "bg-warning-500/15 text-warning-600",
  REJECTED: "bg-danger-500/15 text-danger-600",
  SUPERSEDED: "bg-sunken text-ink-3",
};

const INSIGHT_TYPE_STYLE: Record<InsightType, string> = {
  FACT: "bg-accent-soft text-accent",
  OBSERVATION: "bg-info-500/10 text-info-600",
  INFERENCE: "bg-warning-500/10 text-warning-600",
  PREDICTION: "bg-danger-500/10 text-danger-600",
};

const MEMORY_TYPES = [
  "VERIFIED_FACT",
  "BUSINESS_CONTEXT",
  "BRAND_RULE",
  "APPROVED_REFERENCE",
  "CONTENT_HISTORY",
  "CONTENT_DNA",
  "PERFORMANCE_LEARNING",
  "DECISION_HISTORY",
  "TREND_OBSERVATION",
  "COMPETITOR_OBSERVATION",
  "AUDIENCE_OBSERVATION",
  "GROWTH_LEARNING",
  "STRATEGY_LEARNING",
  "SOURCE_PROVENANCE",
] as const;

type MemoryStatus = "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";

interface Memory {
  id: string;
  type: string;
  content: string;
  source: string | null;
  confidence: number | null;
  verificationStatus: MemoryStatus;
  createdAt: string;
}

const STATUS_STYLE: Record<MemoryStatus, string> = {
  PENDING: "bg-warning-500/15 text-warning-600",
  VERIFIED: "bg-success-500/15 text-success-600",
  REJECTED: "bg-danger-500/15 text-danger-600",
  EXPIRED: "bg-sunken text-ink-3",
};

export default function BrainPage() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [newType, setNewType] = useState<string>("VERIFIED_FACT");
  const [newContent, setNewContent] = useState("");
  const [newSource, setNewSource] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [insights, setInsights] = useState<Insight[]>([]);
  const [nextActions, setNextActions] = useState<NextAction[]>([]);
  const [learnLoading, setLearnLoading] = useState(true);
  const [insightFilter, setInsightFilter] = useState("ALL");

  const loadLearn = useCallback(async () => {
    if (!companyId) return;
    try {
      const params = new URLSearchParams();
      if (insightFilter !== "ALL") params.set("status", insightFilter);
      const res = await apiFetch(`/api/companies/${companyId}/brain/learn?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights || []);
        setNextActions(data.nextActions || []);
      }
    } finally {
      setLearnLoading(false);
    }
  }, [companyId, insightFilter]);

  useEffect(() => {
    loadLearn();
  }, [loadLearn]);

  const insightFeedback = async (insightId: string, action: "verify" | "reject" | "correct") => {
    if (!companyId) return;
    let correction: string | undefined;
    if (action === "correct") {
      correction = window.prompt("What is the correct version of this insight?") ?? undefined;
      if (!correction) return;
    }
    const res = await apiFetch(`/api/companies/${companyId}/brain/learn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insightId, action, correction }),
    });
    if (res.ok) loadLearn();
  };

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (statusFilter !== "ALL") params.set("verificationStatus", statusFilter);
      const res = await apiFetch(`/api/companies/${companyId}/memories?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, typeFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, verificationStatus: "VERIFIED" | "REJECTED") => {
    if (!companyId) return;
    const res = await apiFetch(`/api/companies/${companyId}/memories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verificationStatus }),
    });
    if (res.ok) load();
  };

  const remove = async (id: string) => {
    if (!companyId) return;
    const res = await apiFetch(`/api/companies/${companyId}/memories/${id}`, { method: "DELETE" });
    if (res.ok) load();
  };

  const create = async () => {
    if (!companyId || !newContent.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/companies/${companyId}/memories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newType,
          content: newContent.trim(),
          source: newSource.trim() || undefined,
          verificationStatus: "VERIFIED",
          confidence: 0.95,
        }),
      });
      if (res.ok) {
        setNewContent("");
        setNewSource("");
        load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company brain"
        description="Every fact, rule and learning BrainGrow remembers about your business — verified before it's trusted."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Add memory */}
        <Card className="h-fit p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-accent"><Brain className="h-4 w-4" /></span>
            <h3 className="h3 text-ink">Add a memory</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-ink-2">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              >
                {MEMORY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-2">Content</label>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={4}
                placeholder="e.g. Our brand voice is confident, playful and jargon-free."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-2">Source (optional)</label>
              <Input value={newSource} onChange={(e) => setNewSource(e.target.value)} placeholder="e.g. brand-guidelines.pdf" className="mt-1" />
            </div>
            <Button onClick={create} disabled={submitting || !newContent.trim()} className="w-full">
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              Save to brain
            </Button>
          </div>
        </Card>

        {/* Memory list */}
        <div className="space-y-3 lg:col-span-2">
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <Filter className="h-4 w-4 shrink-0 text-ink-3" />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink outline-none focus:border-accent">
              <option value="ALL">All types</option>
              {MEMORY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink outline-none focus:border-accent">
              <option value="ALL">All statuses</option>
              <option value="VERIFIED">Verified</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <span className="ml-auto text-xs text-ink-3">{memories.length} memories</span>
          </Card>

          {loading && <Card className="flex items-center justify-center p-10 text-ink-3"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</Card>}
          {!loading && memories.length === 0 && <Card className="p-10 text-center text-sm text-ink-3">No memories yet — add one or let your agents record learnings.</Card>}
          {!loading && memories.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">{m.type.replace(/_/g, " ")}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", STATUS_STYLE[m.verificationStatus])}>{m.verificationStatus}</span>
                    {typeof m.confidence === "number" && <span className="text-[10px] text-ink-3">conf {Math.round(m.confidence * 100)}%</span>}
                  </div>
                  <p className="text-sm text-ink">{m.content}</p>
                  <div className="mt-1.5 flex gap-4 text-[10px] text-ink-3">
                    {m.source && <span>source: {m.source}</span>}
                    <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {m.verificationStatus !== "VERIFIED" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-success-600 hover:text-success-600" onClick={() => setStatus(m.id, "VERIFIED")} title="Verify">
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  )}
                  {m.verificationStatus !== "REJECTED" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-danger-500 hover:text-danger-500" onClick={() => setStatus(m.id, "REJECTED")} title="Reject">
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-ink-3 hover:text-danger-500" onClick={() => remove(m.id)} title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Adaptive learning */}
      <div className="pt-2">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-accent"><Sparkles className="h-4 w-4" /></span>
            <div>
              <h3 className="h3 text-ink">Adaptive learning</h3>
              <p className="text-xs text-ink-3">Insights the brain auto-discovers from events — promoted to an ACTIVE fact as confidence and evidence grow, decayed when stale, and corrected by your feedback.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadLearn} className="shrink-0">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reconcile
          </Button>
        </div>

        {nextActions.length > 0 && (
          <Card className="mb-4 border-accent/30">
            <div className="border-b border-line-2 p-4">
              <h4 className="text-sm font-semibold text-ink">Recommended next actions (decision engine)</h4>
              <p className="text-xs text-ink-3">Ranked by confidence × expected impact; every action cites its underlying insight.</p>
            </div>
            <div className="divide-y divide-line-2">
              {nextActions.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-4">
                  <div className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded bg-accent-soft px-1 text-[10px] font-bold text-accent">{Math.round(a.priorityScore * 100)}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{a.title}</p>
                    <p className="mt-0.5 text-xs text-ink-2">{a.reasoning}</p>
                    <p className="mt-1 text-[10px] text-ink-3">
                      confidence {Math.round(a.evidence.confidence * 100)}% · evidence {a.evidence.evidenceCount} · impact {Math.round(a.expectedImpact * 100)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="mb-3 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <Filter className="h-4 w-4 shrink-0 text-ink-3" />
          <select value={insightFilter} onChange={(e) => setInsightFilter(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink outline-none focus:border-accent">
            <option value="ALL">All statuses</option>
            {INSIGHT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="ml-auto text-xs text-ink-3">{insights.length} insights</span>
        </Card>

        {learnLoading && <Card className="flex items-center justify-center p-10 text-ink-3"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading learning…</Card>}
        {!learnLoading && insights.length === 0 && <Card className="p-10 text-center text-sm text-ink-3">No insights yet — publish content, log approvals and observations and the brain will start learning.</Card>}
        {!learnLoading && insights.map((ins) => {
          const removable = ["CANDIDATE", "VALIDATED", "ACTIVE"].includes(ins.status);
          return (
            <Card key={ins.id} className="mb-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", INSIGHT_TYPE_STYLE[ins.type])}>{ins.type}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", INSIGHT_STATUS_STYLE[ins.status])}>{ins.status}</span>
                    {ins.entityKind && <span className="text-[10px] text-ink-3">{ins.entityKind} · {ins.entityId}</span>}
                  </div>
                  <p className="text-sm text-ink">{ins.content}</p>
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-ink-3">
                      <span>confidence</span>
                      <span>{Math.round(ins.confidence * 100)}%</span>
                    </div>
                    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-sunken">
                      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(ins.confidence * 100)}%` }} />
                    </div>
                  </div>
                  <div className="mt-1.5 flex gap-4 text-[10px] text-ink-3">
                    <span>evidence {ins.evidenceCount}</span>
                    <span>samples {ins.sampleSize}</span>
                    <span>{new Date(ins.lastReinforcedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                {removable && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-success-600 hover:bg-success-500/10" onClick={() => insightFeedback(ins.id, "verify")} title="Verify — boost confidence">
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-info-600 hover:bg-info-500/10" onClick={() => insightFeedback(ins.id, "correct")} title="Correction supersedes this insight">
                      <Sparkles className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-danger-500 hover:bg-danger-500/10" onClick={() => insightFeedback(ins.id, "reject")} title="Reject — stop trusting this">
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
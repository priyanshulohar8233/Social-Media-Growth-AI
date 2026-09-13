"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";
import { Loader2, Bot, Play, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentTask {
  id: string;
  name: string;
  status: string;
  output: string | null;
  error: string | null;
}

interface AgentRun {
  id: string;
  agentType: string;
  status: string;
  input: string | null;
  output: string | null;
  error: string | null;
  createdAt: string;
  tasks: AgentTask[];
}

const WORKFLOWS = [
  { id: "content-generation", label: "Content generation", desc: "Research → Strategy → Content → Image/Video → Review" },
  { id: "research-only", label: "Research only", desc: "Trends, competitors, audience signals" },
  { id: "strategy-only", label: "Strategy", desc: "Research → positioning strategy" },
  { id: "full-cycle", label: "Full cycle", desc: "Research → Content → Image/Video → Review → Analytics → Growth" },
] as const;

const RUN_STATUS: Record<string, string> = {
  QUEUED: "bg-sunken text-ink-2",
  RUNNING: "bg-info-500/15 text-info-600",
  COMPLETED: "bg-success-500/15 text-success-600",
  FAILED: "bg-danger-500/15 text-danger-600",
};

export default function AgentsPage() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [workflow, setWorkflow] = useState<string>("content-generation");
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await apiFetch(`/api/companies/${companyId}/agents/run`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async () => {
    if (!companyId || !input.trim()) return;
    setRunning(true);
    try {
      const res = await apiFetch(`/api/companies/${companyId}/agents/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow, input: input.trim() }),
      });
      if (res.ok) {
        setInput("");
        await load();
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="AI agents" description="Run your agency through research, strategy and content workflows. Outputs are stored line-by-line and auditable." />

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Bot className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-ink">Run a workflow</h3>
        </div>
        <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {WORKFLOWS.map((w) => (
            <button
              key={w.id}
              onClick={() => setWorkflow(w.id)}
              className={cn(
                "rounded-lg border p-2.5 text-left transition-colors",
                workflow === w.id ? "border-accent bg-accent-soft/40" : "border-line-2 bg-surface hover:border-line-3"
              )}
            >
              <p className="text-xs font-semibold text-ink">{w.label}</p>
              <p className="mt-0.5 text-[10px] text-ink-3">{w.desc}</p>
            </button>
          ))}
        </div>
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} placeholder="e.g. Create a 7-day content plan around our new product launch" className="mb-2" />
        <Button onClick={run} disabled={running || !input.trim()}>
          {running ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />} Run workflow
        </Button>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="h3 text-ink">Recent runs</h3>
        <Button variant="ghost" size="sm" onClick={load}><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Refresh</Button>
      </div>

      {loading && <Card className="flex items-center justify-center p-10 text-ink-3"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</Card>}
      {!loading && runs.length === 0 && <Card className="p-10 text-center text-sm text-ink-3">No runs yet — kick off a workflow above.</Card>}

      {!loading && runs.map((r) => {
        const isOpen = expanded === r.id;
        return (
          <Card key={r.id} className="mb-3">
            <button onClick={() => setExpanded(isOpen ? null : r.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4 text-ink-3" /> : <ChevronRight className="h-4 w-4 text-ink-3" />}
                <span className="text-sm font-medium text-ink">{r.agentType}</span>
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", RUN_STATUS[r.status] || "bg-sunken text-ink-2")}>{r.status}</span>
              </div>
              <div className="flex items-center gap-3">
                {r.input && <span className="hidden max-w-[240px] truncate text-xs text-ink-3 sm:block">{r.input.slice(0, 60)}</span>}
                <span className="text-[10px] text-ink-3">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-line-2 p-4">
                {r.input && (
                  <div className="mb-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Input</p>
                    <p className="text-xs text-ink-2">{r.input}</p>
                  </div>
                )}
                {r.tasks && r.tasks.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Agent phases</p>
                    {r.tasks.map((t) => (
                      <details key={t.id} className="rounded-md border border-line-2 bg-surface">
                        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-ink">
                          <span className={cn("h-1.5 w-1.5 rounded-full", t.status === "COMPLETED" ? "bg-success-500" : t.status === "FAILED" ? "bg-danger-500" : "bg-warning-500")} />
                          {t.name}
                          <Badge variant="outline" className="ml-auto">{t.status}</Badge>
                        </summary>
                        <div className="px-3 pb-3">
                          {t.error && <p className="mt-1 text-xs text-danger-500">{t.error}</p>}
                          {t.output ? (
                            <pre className="mt-1 max-h-72 overflow-auto rounded-md bg-sunken p-2 text-[11px] text-ink-2 whitespace-pre-wrap">{prettyOutput(t.output)}</pre>
                          ) : (
                            <p className="mt-1 text-xs text-ink-3">No output recorded.</p>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                )}
                {r.output && (
                  <div className="mt-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Run output</p>
                    <pre className="max-h-96 overflow-auto rounded-md bg-sunken p-2 text-[11px] text-ink-2 whitespace-pre-wrap">{prettyOutput(r.output)}</pre>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function prettyOutput(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}
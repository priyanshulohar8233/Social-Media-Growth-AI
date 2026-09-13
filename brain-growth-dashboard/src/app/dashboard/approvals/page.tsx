"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";
import { Loader2, Check, X, RefreshCw, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApprovalContent {
  id: string;
  title: string;
  platform: string | null;
  status: string | null;
}

interface Approval {
  id: string;
  status: string;
  comments: string | null;
  createdAt: string;
  content: ApprovalContent | null;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-warning-500/15 text-warning-600",
  APPROVED: "bg-success-500/15 text-success-600",
  REJECTED: "bg-danger-500/15 text-danger-600",
  CHANGES_REQUESTED: "bg-info-500/15 text-info-500",
};

export default function ApprovalsPage() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deciding, setDeciding] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const res = await apiFetch(`/api/companies/${companyId}/approvals?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals || []);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: string, action: "approve" | "reject" | "request_changes") => {
    if (!companyId) return;
    setDeciding(id);
    try {
      const res = await apiFetch(`/api/companies/${companyId}/approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comments: comments[id] || undefined }),
      });
      if (res.ok) load();
    } finally {
      setDeciding(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Review and decide on content before it ships. Approved posts are recorded as verified brain learnings."
      />

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink outline-none focus:border-accent">
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CHANGES_REQUESTED">Changes requested</option>
          </select>
          <Button variant="ghost" size="icon" onClick={load} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button>
        </div>
        <span className="ml-auto text-xs text-ink-3">{approvals.length} items</span>
      </Card>

      {loading && <Card className="flex items-center justify-center p-10 text-ink-3"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</Card>}
      {!loading && approvals.length === 0 && <Card className="p-10 text-center text-sm text-ink-3">No approvals yet.</Card>}

      {!loading && approvals.map((a) => (
        <Card key={a.id} className="p-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", STATUS_STYLE[a.status] || "bg-sunken text-ink-3")}>{a.status.replace(/_/g, " ")}</span>
            {a.content?.platform && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">{a.content.platform}</span>}
            <span className="flex items-center gap-1 text-[10px] text-ink-3"><Clock className="h-3 w-3" /> {new Date(a.createdAt).toLocaleString()}</span>
          </div>
          <p className="text-sm font-medium text-ink">{a.content?.title || "Untitled content"}</p>
          {a.comments && <p className="mt-1 text-xs text-ink-3">Comment: {a.comments}</p>}

          {a.status === "PENDING" && (
            <div className="mt-3 flex flex-col gap-2">
              <Textarea
                rows={2}
                value={comments[a.id] || ""}
                onChange={(e) => setComments((prev) => ({ ...prev, [a.id]: e.target.value }))}
                placeholder="Optional review comment…"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="default" onClick={() => decide(a.id, "approve")} disabled={deciding === a.id}>
                  {deciding === a.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide(a.id, "request_changes")} disabled={deciding === a.id}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Request changes
                </Button>
                <Button size="sm" variant="destructive" onClick={() => decide(a.id, "reject")} disabled={deciding === a.id}>
                  {deciding === a.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1.5 h-3.5 w-3.5" />}
                  Reject
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
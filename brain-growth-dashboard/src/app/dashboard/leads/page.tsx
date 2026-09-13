"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";
import { Loader2, Plus, UserPlus, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUSES = ["new", "contacted", "qualified", "won", "lost"] as const;
type LeadStatus = (typeof STATUSES)[number];

interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  source: string | null;
  status: LeadStatus;
  meta: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<LeadStatus, string> = {
  new: "bg-info-500/15 text-info-500",
  contacted: "bg-warning-500/15 text-warning-600",
  qualified: "bg-accent-soft text-accent",
  won: "bg-success-500/15 text-success-600",
  lost: "bg-sunken text-ink-3",
};

export default function LeadsPage() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [byStatus, setByStatus] = useState<{ status: string; _count: { id: number } }[]>([]);
  const [conversions, setConversions] = useState<{ total: number; value: number }>({ total: 0, value: 0 });
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await apiFetch(`/api/companies/${companyId}/leads`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        setByStatus(data.byStatus || []);
        setConversions(data.conversions || { total: 0, value: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!companyId || (!name.trim() && !email.trim())) return;
    setAdding(true);
    try {
      const res = await apiFetch(`/api/companies/${companyId}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, email: email.trim() || undefined, source: source.trim() || "manual" }),
      });
      if (res.ok) {
        setName("");
        setEmail("");
        setSource("");
        load();
      }
    } finally {
      setAdding(false);
    }
  };

  const setStatus = async (id: string, status: LeadStatus) => {
    if (!companyId) return;
    const res = await apiFetch(`/api/companies/${companyId}/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) load();
  };

  const totalBy = (s: string) => byStatus.find((b) => b.status === s)?._count.id ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads & ROI"
        description="Track leads captured from your content and the revenue they generate."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-ink-3">Total leads</p>
          <p className="mt-1 text-2xl font-bold text-ink">{leads.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-3">Won</p>
          <p className="mt-1 text-2xl font-bold text-success-600">{totalBy("won")}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-3">Conversions value</p>
          <p className="mt-1 text-2xl font-bold text-ink">₹{conversions.value.toLocaleString()}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-ink">Add lead</h3>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Lead name" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" aria-label="Lead email" />
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source (e.g. blog post)" aria-label="Lead source" />
          <Button onClick={add} disabled={adding || (!name.trim() && !email.trim())}>
            {adding ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />} Add lead
          </Button>
        </div>
      </Card>

      {loading && <Card className="flex items-center justify-center p-10 text-ink-3"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</Card>}
      {!loading && leads.length === 0 && <Card className="p-10 text-center text-sm text-ink-3">No leads yet — add one above or tag a conversion from your content.</Card>}

      {!loading && leads.length > 0 && (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line-2">
            {leads.map((l) => (
              <div key={l.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sunken text-ink-2">
                  <Wallet className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{l.name || "Unnamed lead"}</p>
                  <p className="truncate text-[11px] text-ink-3">
                    {l.email || "no email"} · {l.source || "unknown source"} · {new Date(l.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded px-2 py-1 text-[10px] font-semibold", STATUS_STYLE[l.status])}>.{l.status}</span>
                  <select
                    value={l.status}
                    onChange={(e) => setStatus(l.id, e.target.value as LeadStatus)}
                    className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent"
                    aria-label="Update lead status"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
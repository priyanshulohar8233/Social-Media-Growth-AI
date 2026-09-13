"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";
import { Loader2, Mail, Inbox, Send, Sparkles, Archive, Trash2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  platform: string;
  channelType: string;
  direction: string;
  authorHandle: string | null;
  authorName: string | null;
  content: string;
  sentiment: string | null;
  intent: string | null;
  status: string;
  replyText: string | null;
  aiSuggestion: string | null;
  aiSuggestionTone: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  unread: "bg-danger-500/15 text-danger-500",
  read: "bg-sunken text-ink-2",
  replied: "bg-success-500/15 text-success-600",
  archived: "bg-sunken text-ink-3",
};

const SENTIMENT_STYLE: Record<string, string> = {
  negative: "text-danger-500",
  positive: "text-success-600 dark:text-success-400",
  question: "text-info-600 dark:text-info-400",
  neutral: "text-ink-3",
};

export default function InboxPage() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const [messages, setMessages] = useState<Msg[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [reply, setReply] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    try {
      const res = await apiFetch(`/api/companies/${companyId}/inbox?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setCounts(data.counts || {});
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const suggest = async (id: string) => {
    if (!companyId) return;
    setSuggesting(true);
    try {
      const res = await apiFetch(`/api/companies/${companyId}/inbox/${id}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setReply(data.suggestion || "");
        load();
      }
    } finally {
      setSuggesting(false);
    }
  };

  const mark = async (id: string, status: string) => {
    if (!companyId) return;
    await apiFetch(`/api/companies/${companyId}/inbox/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const sendReply = async (id: string) => {
    if (!companyId || !reply.trim()) return;
    await apiFetch(`/api/companies/${companyId}/inbox/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replyText: reply.trim() }),
    });
    setReply("");
    load();
  };

  const remove = async (id: string) => {
    if (!companyId) return;
    await apiFetch(`/api/companies/${companyId}/inbox/${id}`, { method: "DELETE" });
    setSelected(null);
    load();
  };

  const selectedMsg = messages.find((m) => m.id === selected) || null;

  return (
    <div className="space-y-6">
      <PageHeader title="Social inbox" description="Comments, mentions and DMs from your platforms — with ai-assisted replies." />

      {/* Demo intake: without live platform APIs you can add a message to see the full flow */}
      <Composer companyId={companyId} onCreated={load} />

      <Card className="mb-3 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <Inbox className="h-4 w-4 shrink-0 text-ink-3" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink outline-none focus:border-accent">
          <option value="ALL">All</option>
          <option value="unread">Unread ({counts.unread ?? 0})</option>
          <option value="read">Read</option>
          <option value="replied">Replied</option>
          <option value="archived">Archived</option>
        </select>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={load}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh</Button>
      </Card>

      {loading && <Card className="flex items-center justify-center p-10 text-ink-3"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</Card>}
      {!loading && messages.length === 0 && <Card className="p-10 text-center text-sm text-ink-3">Inbox is empty — add a message to start the flow.</Card>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
          {!loading && messages.map((m) => (
            <Card key={m.id} className={cn("cursor-pointer p-4 transition-colors", selected === m.id && "border-accent")} onClick={() => { setSelected(m.id); if (m.status === "unread") mark(m.id, "read"); }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-sunken px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-2">{m.platform}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", STATUS_STYLE[m.status] || "bg-sunken text-ink-2")}>{m.status}</span>
                    {m.intent && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">{m.intent}</span>}
                    <span className={cn("text-[10px] font-medium", SENTIMENT_STYLE[m.sentiment ?? "neutral"] || "")}>{m.sentiment}</span>
                  </div>
                  <p className="text-sm text-ink">{m.content}</p>
                  <div className="mt-1 flex gap-4 text-[10px] text-ink-3">
                    <span>{m.channelType} · {m.authorHandle || "anonymous"}</span>
                    <span>{new Date(m.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          <Card className="h-fit p-4">
            <div className="mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-ink">Conversation</h3>
            </div>
            {!selectedMsg && <p className="py-6 text-center text-xs text-ink-3">Select a message to reply.</p>}
            {selectedMsg && (
              <div className="space-y-3">
                <div className="rounded-md border border-line-2 bg-surface p-3">
                  <p className="text-xs text-ink">{selectedMsg.content}</p>
                  <p className="mt-1 text-[10px] text-ink-3">{selectedMsg.authorHandle || "anonymous"} · {selectedMsg.platform} {selectedMsg.channelType}</p>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => suggest(selectedMsg.id)} disabled={suggesting}>
                  {suggesting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                  Suggest a reply
                </Button>
                {selectedMsg.aiSuggestion && (
                  <div className="rounded-md border border-line-2 bg-sunken p-3">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-3">Suggested ({selectedMsg.aiSuggestionTone})</p>
                    <p className="text-xs text-ink">{selectedMsg.aiSuggestion}</p>
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => setReply(selectedMsg.aiSuggestion || "")}>Use as reply</Button>
                  </div>
                )}
                <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a reply…" />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => sendReply(selectedMsg.id)} disabled={!reply.trim()}>
                    <Send className="mr-1.5 h-3.5 w-3.5" /> Send reply
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => mark(selectedMsg.id, "archived")} title="Archive"><Archive className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="text-danger-500 hover:text-danger-500" onClick={() => remove(selectedMsg.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Composer({ companyId, onCreated }: { companyId: string | undefined; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState("instagram");
  const [channelType, setChannelType] = useState("comment");
  const [authorHandle, setAuthorHandle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!companyId || !content.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/companies/${companyId}/inbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, channelType, content: content.trim(), authorHandle: authorHandle.trim() || undefined }),
      });
      if (res.ok) {
        setContent("");
        setAuthorHandle("");
        setOpen(false);
        onCreated();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4">
      {open ? (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent">
              {["instagram", "tiktok", "youtube", "linkedin", "twitter"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={channelType} onChange={(e) => setChannelType(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent">
              {["comment", "dm", "mention", "message"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <Input value={authorHandle} onChange={(e) => setAuthorHandle(e.target.value)} placeholder="@user" aria-label="Author handle" />
          </div>
          <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Message text" />
          <div className="flex gap-2">
            <Button onClick={create} disabled={saving || !content.trim()}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Add message
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm text-ink-3 hover:text-ink">
          <PlusIcon /> Add an inbound message (demo intake without live platform APIs)
        </button>
      )}
    </Card>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return <span className={cn("flex h-5 w-5 items-center justify-center rounded bg-accent-soft text-accent", className)}>+</span>;
}
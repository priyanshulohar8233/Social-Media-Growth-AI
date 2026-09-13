"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";
import { Loader2, Image, Film, FileText, Trash2, Plus, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface Asset {
  id: string;
  originalName: string;
  mimeType: string;
  url: string;
  type: string;
  createdAt: string;
}

const TYPE_META: Record<string, { icon: typeof Image; label: string }> = {
  image: { icon: Image, label: "Image" },
  video: { icon: Film, label: "Video" },
  document: { icon: FileText, label: "Document" },
  other: { icon: FolderOpen, label: "Other" },
};

export default function MediaPage() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [originalName, setOriginalName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("image");
  const [filter, setFilter] = useState("ALL");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    const params = new URLSearchParams();
    if (filter !== "ALL") params.set("type", filter);
    try {
      const res = await apiFetch(`/api/companies/${companyId}/media?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!companyId || !url.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/companies/${companyId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), originalName: originalName.trim() || undefined, type }),
      });
      if (res.ok) {
        setUrl("");
        setOriginalName("");
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!companyId) return;
    await apiFetch(`/api/companies/${companyId}/media/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Media library" description="Your image, video and document assets — referenced by content and generation jobs." />

      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Plus className="h-4 w-4 text-accent" /> Add an asset</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <Input value={originalName} onChange={(e) => setOriginalName(e.target.value)} placeholder="Name (optional)" aria-label="Asset name" />
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… or /uploads/…" aria-label="Asset URL" className="sm:col-span-2" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent">
            {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <Button onClick={add} disabled={saving || !url.trim()} className="mt-2">
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />} Add asset
        </Button>
        <p className="mt-2 text-[10px] text-ink-3">Library stores references to your media. File upload/storage sits behind storage credentials.</p>
      </Card>

      <div className="flex flex-wrap gap-2">
        {["ALL", ...Object.keys(TYPE_META)].map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>{f === "ALL" ? "All" : TYPE_META[f].label}</Button>
        ))}
      </div>

      {loading && <Card className="flex items-center justify-center p-10 text-ink-3"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</Card>}
      {!loading && assets.length === 0 && <Card className="p-10 text-center text-sm text-ink-3">No assets yet — add your first one above.</Card>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {!loading && assets.map((a) => {
          const meta = TYPE_META[a.type] || TYPE_META.other;
          return (
            <Card key={a.id} className="p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent"><meta.icon className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{a.originalName}</p>
                    <p className="text-[10px] text-ink-3">{meta.label} · {new Date(a.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-ink-3 hover:text-danger-500" onClick={() => remove(a.id)} aria-label="Delete asset">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {a.type === "image" || a.type === "video" ? (
                <div className={cn("relative overflow-hidden rounded-md bg-sunken")}>
                  {a.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt={a.originalName} className="h-36 w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="flex h-24 items-center justify-center text-ink-3"><Film className="h-6 w-6" /></div>
                  )}
                </div>
              ) : (
                <div className="flex h-10 items-center rounded-md bg-sunken px-2 text-xs text-ink-3 truncate">{a.url}</div>
              )}
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block truncate text-[11px] text-accent hover:underline">{a.url}</a>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
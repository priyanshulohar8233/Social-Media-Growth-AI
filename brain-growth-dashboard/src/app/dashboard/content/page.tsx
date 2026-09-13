"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Plus, Calendar, Heart, MessageCircle, X, Loader2, BarChart3, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";

const statusVariant: Record<string, "success" | "warning" | "neutral"> = {
  published: "success",
  scheduled: "warning",
  draft: "neutral",
};

const PLATFORMS = ["instagram", "youtube", "linkedin", "facebook", "twitter", "tiktok"];

export default function ContentPage() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;
  const [posts, setPosts] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    platform: "instagram",
    contentType: "POST",
    scheduledAt: "",
    hook: "",
    cta: "",
  });
  const [perfPost, setPerfPost] = useState<any | null>(null);
  const [perfForm, setPerfForm] = useState({ views: "", likes: "", comments: "", shares: "", saves: "" });
  const [perfSaving, setPerfSaving] = useState(false);
  const [perfSaved, setPerfSaved] = useState(false);
  const [perfError, setPerfError] = useState<string | null>(null);

  const load = async (cid: string) => {
    try {
      const r = await apiFetch(`/api/companies/${cid}/content`);
      if (!r.ok) throw new Error("fail");
      const d = await r.json();
      setPosts(transformPosts(d.contents ?? []));
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load(companyId);
  }, [companyId]);

  const filtered = filter === "all" ? posts : posts.filter(p => p.status === filter);

  const handleCreate = async () => {
    if (!companyId) return;
    if (!form.title.trim()) {
      setFormError("Title is required");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const r = await apiFetch(`/api/companies/${companyId}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          platform: form.platform,
          contentType: form.contentType,
          hook: form.hook.trim() || undefined,
          cta: form.cta.trim() || undefined,
          scheduledAt: form.scheduledAt || undefined,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setFormError(j.error || "Failed to create post");
      } else {
        setCreating(false);
        setForm({ title: "", platform: "instagram", contentType: "POST", scheduledAt: "", hook: "", cta: "" });
        await load(companyId);
      }
    } catch {
      setFormError("Network error");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !companyId) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-sunken" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map(i => <div key={i} className="h-52 animate-pulse rounded-lg bg-sunken" />)}</div>
      </div>
    );
  }

  const openPerf = (post: any) => {
    setPerfPost(post);
    setPerfForm({ views: "", likes: "", comments: "", shares: "", saves: "" });
    setPerfSaved(false);
    setPerfError(null);
  };

  const handleRecordPerformance = async () => {
    if (!companyId || !perfPost) return;
    setPerfSaving(true);
    setPerfError(null);
    try {
      const r = await apiFetch(`/api/companies/${companyId}/content/${perfPost.id}/performance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          views: Number(perfForm.views) || 0,
          likes: Number(perfForm.likes) || 0,
          comments: Number(perfForm.comments) || 0,
          shares: Number(perfForm.shares) || 0,
          saves: Number(perfForm.saves) || 0,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setPerfError(j.error || "Failed to record performance");
      } else {
        setPerfSaved(true);
        await load(companyId);
      }
    } catch {
      setPerfError("Network error");
    } finally {
      setPerfSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        description="Manage all your social media posts."
        actions={<Button onClick={() => setCreating(true)}><Plus className="mr-1.5 h-4 w-4" /> Create post</Button>}
      />

      {/* Create post form */}
      {creating && (
        <Card>
          <div className="flex items-center justify-between border-b border-line-2 p-5">
            <h2 className="h3 text-ink">New post</h2>
            <button onClick={() => setCreating(false)} className="rounded-md p-1 text-ink-3 hover:bg-sunken hover:text-ink" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="label">Title *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. 5 ways to grow your audience" />
            </div>
            <div className="space-y-1.5">
              <label className="label">Platform</label>
              <select
                className="w-full h-9 rounded-md border border-line-2 bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
              >
                {PLATFORMS.map((p) => <option key={p} value={p} className="bg-surface">{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="label">Format</label>
              <select
                className="w-full h-9 rounded-md border border-line-2 bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.contentType}
                onChange={(e) => setForm({ ...form, contentType: e.target.value })}
              >
                {["POST", "REEL", "CAROUSEL", "STORY", "VIDEO", "THREAD", "SHORT"].map((t) => <option key={t} value={t} className="bg-surface">{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="label">Hook</label>
              <Input value={form.hook} onChange={(e) => setForm({ ...form, hook: e.target.value })} placeholder="Attention-grabbing opening" />
            </div>
            <div className="space-y-1.5">
              <label className="label">CTA</label>
              <Input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} placeholder="Link in bio / Save this" />
            </div>
            <div className="space-y-1.5">
              <label className="label">Scheduled at</label>
              <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
            </div>
            {formError && <p className="text-xs text-danger-500 sm:col-span-2">{formError}</p>}
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
                {saving ? "Creating…" : "Create draft"}
              </Button>
              <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="flex gap-1.5">
        {["all", "published", "scheduled", "draft"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "h-8 rounded-full px-3.5 text-sm font-medium capitalize transition-colors duration-150",
              filter === f ? "bg-accent text-white" : "border border-line-2 bg-surface text-ink-2 hover:bg-sunken"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><div className="py-16 text-center text-sm text-ink-3">No {filter === "all" ? "" : filter + " "}posts yet</div></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((post) => (
            <Card key={post.id} className="flex flex-col">
              <div className="flex items-center justify-between p-4">
                <span className="flex h-6 items-center gap-1.5 rounded-md bg-sunken px-2 text-xs font-medium text-ink-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-surface text-[9px] font-bold text-ink-2">{post.platform?.charAt(0).toUpperCase()}</span>
                  {post.platform}
                </span>
                <Badge variant={statusVariant[post.status] || "neutral"} className="capitalize">{post.status}</Badge>
              </div>
              <div className="flex-1 px-4 pb-3">
                <h3 className="line-clamp-2 text-sm font-semibold text-ink">{post.title}</h3>
              </div>
              <div className="flex items-center justify-between border-t border-line-2 px-4 py-3">
                <div className="flex items-center gap-4 text-xs tabular-nums text-ink-3">
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {post.date}</span>
                  <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {post.likes.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {post.comments}</span>
                </div>
                {["published", "approved"].includes(post.status) && (
                  <Button variant="outline" size="sm" onClick={() => openPerf(post)}>
                    <BarChart3 className="mr-1 h-3.5 w-3.5" /> Record
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Record performance modal */}
      {perfPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !perfSaving && setPerfPost(null)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line-2 p-5">
              <div>
                <h2 className="h3 text-ink">Record performance</h2>
                <p className="mt-0.5 line-clamp-1 text-xs text-ink-3">{perfPost.title}</p>
              </div>
              <button onClick={() => !perfSaving && setPerfPost(null)} className="rounded-md p-1 text-ink-3 hover:bg-sunken hover:text-ink" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              {perfSaved ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-500/15 text-success-600"><Check className="h-6 w-6" /></span>
                  <p className="text-sm font-medium text-ink">Performance recorded!</p>
                  <p className="text-xs text-ink-3">The brain is now learning from this post — next content will be smarter.</p>
                  <Button onClick={() => setPerfPost(null)}>Done</Button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-ink-3">Enter the real numbers from your social platform. This feeds the brain so future content improves.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      ["views", "Views", "e.g. 12500"],
                      ["likes", "Likes", "e.g. 840"],
                      ["comments", "Comments", "e.g. 96"],
                      ["shares", "Shares", "e.g. 210"],
                      ["saves", "Saves", "e.g. 430"],
                    ] as const).map(([key, label, ph]) => (
                      <div key={key} className="space-y-1.5">
                        <label className="label">{label}</label>
                        <Input
                          type="number"
                          min={0}
                          value={perfForm[key]}
                          onChange={(e) => setPerfForm({ ...perfForm, [key]: e.target.value })}
                          placeholder={ph}
                        />
                      </div>
                    ))}
                  </div>
                  {perfError && <p className="text-xs text-danger-500">{perfError}</p>}
                  <div className="flex gap-2 pt-1">
                    <Button onClick={handleRecordPerformance} disabled={perfSaving} className="flex-1">
                      {perfSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-1.5 h-4 w-4" />}
                      {perfSaving ? "Saving…" : "Save performance"}
                    </Button>
                    <Button variant="outline" onClick={() => setPerfPost(null)} disabled={perfSaving}>Cancel</Button>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function transformPosts(contents: any[]) {
  return contents.map((c: any) => {
    const date = c.publishedAt ? new Date(c.publishedAt) : c.scheduledAt ? new Date(c.scheduledAt) : new Date(c.createdAt);
    // likes/comments snapshot from social posts metrics if linked, else 0
    return {
      id: c.id,
      title: c.title,
      platform: c.platform,
      status: (c.status || "draft").toLowerCase(),
      date: date.toISOString().slice(0, 10),
      likes: c.likes ?? 0,
      comments: c.comments ?? 0,
    };
  });
}
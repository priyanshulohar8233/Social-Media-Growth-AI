"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";
import { Loader2, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const PLATFORMS = ["instagram", "tiktok", "youtube", "linkedin", "twitter", "facebook"] as const;

interface CalendarItem {
  id: string;
  date: string;
  platform: string;
  status: string;
  title: string | null;
}

export default function CalendarPage() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [draft, setDraft] = useState<{ date: string; platform: string; title: string }>({ date: "", platform: "instagram", title: "" });
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await apiFetch(`/api/companies/${companyId}/calendar?month=${month}&year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const days = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const startOffset = first.getDay(); // 0=Sun
    const totalDays = new Date(year, month, 0).getDate();
    return [...Array(startOffset).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];
  }, [year, month]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const key = it.date.slice(0, 10);
      const list = map.get(key) || [];
      list.push(it);
      map.set(key, list);
    }
    return map;
  }, [items]);

  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const add = async () => {
    if (!companyId || !draft.date) return;
    setAdding(true);
    try {
      const res = await apiFetch(`/api/companies/${companyId}/calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, date: draft.date, platform: draft.platform, title: draft.title || undefined }),
      });
      if (res.ok) {
        setDraft({ date: "", platform: "instagram", title: "" });
        load();
      }
    } finally {
      setAdding(false);
    }
  };

  const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content calendar"
        description="Plan and review your posting schedule month by month."
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-[140px] text-center text-sm font-semibold text-ink">{monthName}</span>
            <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        }
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} aria-label="Date" />
          <select value={draft.platform} onChange={(e) => setDraft({ ...draft, platform: e.target.value })} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent">
            {PLATFORMS.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
          </select>
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Post title (optional)" aria-label="Title" />
          <Button onClick={add} disabled={adding || !draft.date}>
            {adding ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />} Add
          </Button>
        </div>
      </Card>

      {loading ? (
        <Card className="flex items-center justify-center p-10 text-ink-3"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</Card>
      ) : (
        <Card className="p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-3">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="p-1.5">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              if (d === null) return <div key={`e-${i}`} />;
              const key = `${year}-${month}-${d}`;
              const dayItems = itemsByDate.get(key) || [];
              return (
                <div key={key} className={cn("min-h-[84px] rounded-lg border border-line-2 p-1", dayItems.length > 0 && "bg-accent-soft")}>
                  <div className="text-[11px] font-semibold text-ink">{d}</div>
                  <div className="mt-1 space-y-0.5">
                    {dayItems.slice(0, 2).map((it) => (
                      <div key={it.id} className="rounded bg-surface px-1 py-0.5 text-[9px] leading-tight text-ink line-clamp-1" title={it.title || it.platform}>
                        <span className="capitalize">{it.platform}</span>
                        {it.title ? `: ${it.title}` : ""}
                      </div>
                    ))}
                    {dayItems.length > 2 && <div className="text-[9px] text-ink-3">+{dayItems.length - 2} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
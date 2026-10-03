import { prisma } from "@/lib/db";
import { aiGenerate } from "@/lib/ai/gateway";
import { classifySentiment } from "@/lib/intelligence/intent";
import { logger } from "@/lib/logger";

/**
 * GEO / AI-search Share-of-Voice tracker.
 *
 * For each company we run three prompt sets (Discovery / Research / Decision)
 * through the model gateway and record whether the brand is mentioned, with
 * what sentiment, at which stated position, and with which citations.
 * Without provider keys the gateway falls back to its labeled mock, and rows
 * are attributed as such — never presented as live engine results.
 */

export const GEO_PROMPT_SETS = ["Discovery", "Research", "Decision"] as const;
export type GeoPromptSet = (typeof GEO_PROMPT_SETS)[number];

function buildPrompt(set: GeoPromptSet, companyName: string, industry: string | null): string {
  const who = industry ? `${companyName} (${industry})` : companyName;
  switch (set) {
    case "Discovery":
      return `A user asks an AI assistant: "What are the best options for ${industry || "this category"}?" List the top 5 brands with one line each and cite sources with URLs. Mention rank positions like #1, #2 where relevant.`;
    case "Research":
      return `A user asks an AI assistant: "Compare ${who} against its top competitors for a buyer evaluating options." Give a short comparison with sentiment per brand and cite sources with URLs.`;
    case "Decision":
      return `A user asks an AI assistant: "Should I choose ${who}? Why or why not?" Answer in 3 sentences with a clear recommendation and cite sources with URLs.`;
  }
}

function brandMentioned(text: string, companyName: string): boolean {
  const t = text.toLowerCase();
  const name = companyName.toLowerCase().trim();
  if (!name) return false;
  if (t.includes(name)) return true;
  const first = name.split(/\s+/)[0].replace(/[^a-z0-9]/g, "");
  return first.length >= 4 && t.includes(first);
}

function parsePosition(text: string): number | null {
  const m = text.match(/#(\d{1,2})\b|rank(?:ed)?\s*(?:#|no\.?|number)?\s*(\d{1,2})/i);
  if (!m) return null;
  const n = Number(m[1] ?? m[2]);
  return Number.isFinite(n) && n >= 1 && n <= 50 ? n : null;
}

function parseCitations(text: string): string[] {
  const urls = text.match(/https?:\/\/[^\s)"']+/g) || [];
  return [...new Set(urls)].slice(0, 10);
}

export interface GeoSweepResult {
  companyId: string;
  rows: number;
  mentioned: number;
  provider: string;
}

export async function runGeoSweep(params: { companyId: string; userId?: string | null }): Promise<GeoSweepResult> {
  const { companyId, userId } = params;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true, industry: true } });
  if (!company) throw Object.assign(new Error("Company not found"), { status: 404 });

  let mentioned = 0;
  let provider = "deterministic";
  for (const set of GEO_PROMPT_SETS) {
    const prompt = buildPrompt(set, company.name, company.industry);
    let text = "";
    let rowProvider = "deterministic";
    try {
      const res = await aiGenerate({
        companyId,
        userId: userId || null,
        capability: "reasoning",
        task: "geo-sweep",
        agent: "geo",
        prompt,
      });
      text = res.text || "";
      rowProvider = `${res.modelId}@${res.provider}`;
      provider = rowProvider;
    } catch (e) {
      logger.error("geo sweep generation failed", { ...logger.errorMeta(e), companyId, set });
    }
    const hit = brandMentioned(text, company.name);
    if (hit) mentioned++;
    await prisma.geoVisibility.create({
      data: {
        companyId,
        promptSet: set,
        prompt: prompt.slice(0, 1000),
        engine: "gateway",
        brandMentioned: hit,
        sentiment: classifySentiment(text),
        position: parsePosition(text),
        citations: JSON.stringify(parseCitations(text)),
        rawExcerpt: text.slice(0, 1000),
        provider: rowProvider,
      },
    });
  }
  return { companyId, rows: GEO_PROMPT_SETS.length, mentioned, provider };
}

/** Sweep every company with a membership (bounded) — used by the cron route. */
export async function runGeoSweepAll(limit = 10): Promise<{ companies: number; rows: number; errors: number }> {
  const companies = await prisma.company.findMany({ select: { id: true }, take: Math.max(1, Math.min(limit, 25)) });
  let rows = 0;
  let errors = 0;
  for (const c of companies) {
    try {
      const r = await runGeoSweep({ companyId: c.id });
      rows += r.rows;
    } catch (e) {
      errors++;
      logger.error("geo sweep-all failed for company", { ...logger.errorMeta(e), companyId: c.id });
    }
  }
  return { companies: companies.length, rows, errors };
}

export interface GeoCoverage {
  share: number | null; // 0..100, null when no rows
  total: number;
  mentioned: number;
  bySet: Array<{ set: string; total: number; mentioned: number }>;
  provider: string | null;
}

export async function geoShareOfVoice(companyId: string, days = 30): Promise<GeoCoverage> {
  const since = new Date(Date.now() - days * 864e5);
  const rows = await prisma.geoVisibility.findMany({
    where: { companyId, createdAt: { gte: since } },
    select: { promptSet: true, brandMentioned: true, provider: true },
  });
  if (rows.length === 0) {
    return { share: null, total: 0, mentioned: 0, bySet: [], provider: null };
  }
  const mentioned = rows.filter((r) => r.brandMentioned).length;
  const bySet = GEO_PROMPT_SETS.map((set) => {
    const subset = rows.filter((r) => r.promptSet === set);
    return { set, total: subset.length, mentioned: subset.filter((r) => r.brandMentioned).length };
  });
  const provider = rows.find((r) => r.provider && r.provider !== "deterministic")?.provider ?? rows[0].provider ?? null;
  return { share: Math.round((mentioned / rows.length) * 100), total: rows.length, mentioned, bySet, provider };
}

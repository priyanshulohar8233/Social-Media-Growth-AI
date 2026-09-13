import { prisma } from "@/lib/db";
import { mockEmbedding } from "@/lib/providers/mock";

/**
 * Company Brain — retrieval layer, not retraining.
 * Aggregates: profile + verified memories + documents + performance signals
 * Uses embeddings + metadata for relevance.
 */

export type ProfileType = "BUSINESS" | "CREATOR" | "PERSONAL_BRAND" | "AGENCY";

export interface BrainContext {
  companyId: string;
  profileType: ProfileType;
  profile: Record<string, unknown> | null;
  creatorProfile: Record<string, unknown> | null;
  brandRules: string[];
  creatorRules: string[];
  verifiedMemories: Array<{ type: string; content: string }>;
  recentPerformance: Array<{ metric: string; value: number }>;
  trends: Array<{ title: string; description: string | null }>;
  competitors: Array<{ name: string; notes: string | null }>;
  contentDna: Array<{ hook: string | null; topic: string | null; format: string | null }>;
  pillars: Array<{ name: string }>;
}

export async function buildBrainContext(companyId: string): Promise<BrainContext> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { profileType: true } });
  const profileType = (company?.profileType as ProfileType) || "BUSINESS";

  const [profile, creatorProfile, brandRules, memories, trends, competitors, metrics, contentDna, pillars] = await Promise.all([
    prisma.companyProfile.findUnique({ where: { companyId } }),
    (profileType === "CREATOR" || profileType === "PERSONAL_BRAND")
      ? prisma.creatorProfile.findUnique({ where: { companyId } })
      : Promise.resolve(null),
    prisma.brandRule.findMany({ where: { companyId }, take: 20 }),
    prisma.memory.findMany({
      where: { companyId, verificationStatus: "VERIFIED" },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { type: true, content: true },
    }),
    prisma.trend.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.competitor.findMany({ where: { companyId }, take: 10 }),
    prisma.performanceMetric.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.contentDna.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 10 }),
    (profileType === "CREATOR" || profileType === "PERSONAL_BRAND")
      ? prisma.contentPillar.findMany({ where: { companyId }, take: 10 })
      : Promise.resolve([]),
  ]);

  // For creator, brandRules are actually creator rules
  const creatorRules: string[] = [];
  if (profileType === "CREATOR" || profileType === "PERSONAL_BRAND") {
    const cr = creatorProfile as unknown as Record<string, string> | null;
    if (cr?.creatorVoice) creatorRules.push(`Creator voice: ${cr.creatorVoice}`);
    if (cr?.personality) creatorRules.push(`Personality: ${cr.personality}`);
  }

  return {
    companyId,
    profileType,
    profile: profile as unknown as Record<string, unknown> | null,
    creatorProfile: creatorProfile as unknown as Record<string, unknown> | null,
    brandRules: brandRules.map((r) => r.rule),
    creatorRules,
    verifiedMemories: memories,
    recentPerformance: metrics.map((m) => ({ metric: m.metric, value: m.value })),
    trends: trends.map((t) => ({ title: t.title, description: t.description })),
    competitors: competitors.map((c) => ({ name: c.name, notes: c.notes })),
    contentDna: contentDna.map((d) => ({ hook: d.hook, topic: d.topic, format: d.format })),
    pillars: (pillars as Array<{ name: string }>).map((p) => ({ name: p.name })),
  };
}

export function brainContextToPrompt(ctx: BrainContext): string {
  const parts: string[] = [];
  parts.push(`ProfileType: ${ctx.profileType} | Company: ${ctx.companyId}`);
  if (ctx.profile) parts.push(`Business Profile: ${JSON.stringify(ctx.profile).slice(0, 2000)}`);
  if (ctx.creatorProfile) parts.push(`Creator Profile: ${JSON.stringify(ctx.creatorProfile).slice(0, 2000)}`);
  if (ctx.brandRules.length) parts.push(`Brand rules: ${ctx.brandRules.join("; ")}`);
  if (ctx.creatorRules.length) parts.push(`Creator rules: ${ctx.creatorRules.join("; ")}`);
  if (ctx.pillars.length) parts.push(`Content pillars: ${ctx.pillars.map((p) => p.name).join(", ")}`);
  if (ctx.contentDna.length) parts.push(`Content DNA: ${ctx.contentDna.map((d) => `[hook:${d.hook} topic:${d.topic} format:${d.format}]`).join(" | ").slice(0, 1500)}`);
  if (ctx.verifiedMemories.length) parts.push(`Verified facts: ${ctx.verifiedMemories.map((m) => `[${m.type}] ${m.content}`).join(" | ").slice(0, 3000)}`);
  if (ctx.trends.length) parts.push(`Trends: ${ctx.trends.map((t) => t.title).join(", ")}`);
  if (ctx.competitors.length) parts.push(`Competitors: ${ctx.competitors.map((c) => c.name).join(", ")}`);
  if (ctx.recentPerformance.length) parts.push(`Performance: ${ctx.recentPerformance.map((p) => `${p.metric}=${p.value}`).join(", ")}`);
  return parts.join("\n");
}

/**
 * Semantic retrieval — for now uses mockEmbedding + simple scoring.
 * Replace with real vector search (pgvector / sqlite-vec) when embedding provider is real.
 */
export async function retrieveMemories(companyId: string, query: string, limit = 5) {
  const all = await prisma.memory.findMany({
    where: { companyId, verificationStatus: "VERIFIED" },
    take: 100,
  });
  if (all.length === 0) return [];

  const queryEmb = await mockEmbedding.embed({ text: query, companyId });
  const scored = await Promise.all(
    all.map(async (m) => {
      const emb = m.content ? await mockEmbedding.embed({ text: m.content, companyId }) : queryEmb;
      const score = cosineSimilarity(queryEmb, emb);
      return { memory: m, score };
    })
  );
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.memory);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

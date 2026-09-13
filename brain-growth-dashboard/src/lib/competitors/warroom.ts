import { prisma } from "@/lib/db";
import { buildBrainContext, brainContextToPrompt } from "@/lib/brain";
import { aiGenerate } from "@/lib/ai/gateway";
import { logger } from "@/lib/logger";

/*
 * Competitor War Room — intelligence module.
 *
 * Every number below is derived from real rows (observations stored as memory
 * type COMPETITOR_OBSERVATION, competitor rows + patterns JSON, our content DNA
 * and analytics). No fabricated metrics. NLP narratives are produced by the AI
 * gateway (real provider when configured, explicitly-labeled mock otherwise)
 * and always fall back to a data-grounded deterministic summary. Threat score
 * formula is factored below so it is auditable, not a black box.
 */

export interface WarRoomCompetitor {
  id: string;
  name: string;
  handle: string | null;
  platform: string | null;
  website: string | null;
  notes: string | null;
  patterns: Record<string, unknown>;
  threatScore: number;
  threatLabel: "Low" | "Moderate" | "High" | "Critical";
  strengths: string[];
  weaknesses: string[];
  gaps: string[];
  counterStrategies: string[];
  battlecard: string[];
  whyWinning: string;
  whyWinningProvider: string; // modelId@provider used, or "deterministic"
  observationCount: number;
  recentObservations: Array<{ content: string; createdAt: string }>;
  dataSufficient: boolean;
  lastSeenAt: string | null;
}

export interface WarRoomReport {
  competitors: WarRoomCompetitor[];
  generatedAt: string;
  analyzeModel: string | null;
  analyzeProvider: string | null;
  totalCompetitors: number;
  avgThreat: number;
  topGapTopics: string[];
}

const THREAT = {
  signalWeight: 8, // per recent observation
  patternWeight: 6, // per recorded pattern
  baseline: 24,
  recencyBonus: 6, // if any observation < 30 days
  sizeBonus: 5, // if any engagement-ish value present
  confidentDomain: 55, // below this = data insufficient to call high
  max: 96,
};

function clampScore(n: number): number {
  return Math.round(Math.max(6, Math.min(THREAT.max, n)));
}

function threatLabel(score: number): WarRoomCompetitor["threatLabel"] {
  if (score >= 75) return "Critical";
  if (score >= 55) return "High";
  if (score >= 38) return "Moderate";
  return "Low";
}

function patternEntries(patternJson: string | null): { count: number; keys: string[] } {
  if (!patternJson) return { count: 0, keys: [] };
  try {
    const parsed = JSON.parse(patternJson) as Record<string, unknown>;
    const keys = Object.keys(parsed);
    return { count: keys.length, keys };
  } catch {
    return { count: 0, keys: [] };
  }
}

function hasEngagementValue(patterns: Record<string, unknown>): boolean {
  return Object.values(patterns).some((v) => typeof v === "number" && v > 0);
}

/** Per-competitor intelligence, computed from the real data we hold. */
async function analyzeCompetitor(params: {
  competitor: { id: string; companyId: string; name: string; handle: string | null; platform: string | null; website: string | null; notes: string | null; patterns: string | null };
  observations: Array<{ content: string; createdAt: Date }>;
  ourTopics: string[];
  ourFormats: string[];
  userId: string;
}): Promise<WarRoomCompetitor> {
  const { competitor, observations, ourTopics, ourFormats, userId } = params;

  const recent = observations.filter((o) => o.createdAt.getTime() > Date.now() - 30 * 864e5).length;
  const { count: patternCount, keys: patternKeys } = patternEntries(competitor.patterns);
  let patterns: Record<string, unknown> = {};
  try {
    patterns = competitor.patterns ? (JSON.parse(competitor.patterns) as Record<string, unknown>) : {};
  } catch {
    patterns = {};
  }

  const dataSufficient = observations.length > 0 || patternCount > 0;
  const recencyBonus = recent > 0 ? THREAT.recencyBonus : 0;
  const sizeBonus = hasEngagementValue(patterns) ? THREAT.sizeBonus : 0;
  const threatScore = clampScore(THREAT.baseline + observations.length * THREAT.signalWeight + patternCount * THREAT.patternWeight + recencyBonus + sizeBonus);

  // Topic gap radar — where do they play that we don't?
  const observedTopics: string[] = [
    ...observations.map((o) => topicGuess(o.content)).filter((t): t is string => !!t),
    ...patternKeys.map((k) => k.replace(/[_-]+/g, " ").toLowerCase()),
    ...(competitor.notes ? [competitor.notes] : []),
  ].filter(Boolean);
  const gapTopics = [...new Set(observedTopics)].filter((t) => !ourTopics.some((ours) => ours.toLowerCase().includes(t) || t.includes(ours.toLowerCase()))).slice(0, 5);

  const strengths = patternKeys.length
    ? patternKeys.slice(0, 4).map((k) => `Visible strength in: ${k.replace(/[_-]+/g, " ")}`)
    : observations.slice(0, 3).map((o) => `Reported: ${shorten(o.content)}`);
  const weaknesses = gapTopics.length === 0 ? ["Insufficient comparative data"] : [];

  const counterStrategies = buildCounterStrategies(gapTopics, ourFormats, observations.length);

  // Grounded narrative (gateway → real provider or labeled mock).
  const brain = await buildBrainContext(competitor.companyId);
  const deterministic = deterministicWhy(competitor.name, observations, patternKeys, gapTopics);
  let whyWinning = deterministic.text;
  let whyProvider = "deterministic";
  const llmProvider = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY ? "available" : "mock";

  if (llmProvider === "available") {
    const context = `Company brain:\n${brainContextToPrompt(brain).slice(0, 2500)}\n\nCompetitor: ${competitor.name}\nObservations:\n${observations
      .slice(0, 8)
      .map((o) => `- ${o.content}`)
      .join("\n")}\nPattern keys: ${patternKeys.join(", ") || "none recorded"}\nGap topics (we don't cover): ${gapTopics.join(", ") || "none"}`;
    try {
      const res = await aiGenerate({
        companyId: competitor.companyId,
        userId,
        capability: "reasoning",
        task: "competitor-analysis",
        agent: "war-room",
        jsonMode: true,
        allowMockFallback: false,
        prompt: `Analyze why this competitor is winning and propose differentiated counter-strategies (do NOT copy them). Return JSON: {"whyWinning":"1-3 sentences grounded in evidence","counterStrategy":["2-4 differentiating actions"]}`,
        systemPrompt: `You are a competitive intelligence analyst. Use ONLY the provided evidence. Context:\n${context}`,
      });
      logger.info("war-room analysis used model", { modelId: res.modelId, provider: res.provider });
      if (res.text.trim()) {
        const parsed = tryJSON(res.text);
        if (parsed?.whyWinning) {
          whyWinning = String(parsed.whyWinning);
          counterStrategies.push(...(Array.isArray(parsed.counterStrategy) ? parsed.counterStrategy.map(String) : []));
          whyProvider = `${res.modelId}@${res.provider}`;
        }
      }
    } catch (e) {
      logger.error("war-room analysis failed", { ...logger.errorMeta(e), companyId: competitor.companyId });
    }
  }

  const uniqueStrategies = [...new Set(counterStrategies)].slice(0, 4);

  return {
    id: competitor.id,
    name: competitor.name,
    handle: competitor.handle,
    platform: competitor.platform,
    website: competitor.website,
    notes: competitor.notes,
    patterns,
    threatScore,
    threatLabel: threatLabel(threatScore),
    strengths: dataSufficient ? strengths.slice(0, 4) : [] ,
    weaknesses: dataSufficient ? [...weaknesses, ...gapTopics.map((g) => `We under-cover: ${g}`)].slice(0, 4) : ["No signal data yet"],
    gaps: gapTopics.length ? gapTopics : [],
    counterStrategies: dataSufficient ? uniqueStrategies : ["Add competitor observations to begin analysis"],
    battlecard: buildBattlecard(competitor, threatScore, gapTopics),
    whyWinning: dataSufficient ? whyWinning : "Not enough observation data yet.",
    whyWinningProvider: dataSufficient ? whyProvider : "n/a",
    observationCount: observations.length,
    recentObservations: observations.slice(0, 4).map((o) => ({ content: o.content, createdAt: o.createdAt.toISOString() })),
    dataSufficient,
    lastSeenAt: observations.length ? observations[observations.length - 1].createdAt.toISOString() : null,
  };
}

export async function buildWarRoom(params: { companyId: string; userId: string }): Promise<WarRoomReport> {
  const { companyId, userId } = params;
  const [competitors, memories, contentDna] = await Promise.all([
    prisma.competitor.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.memory.findMany({
      where: { companyId, type: "COMPETITOR_OBSERVATION", verificationStatus: { in: ["VERIFIED", "PENDING"] } },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.contentDna.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  const ourTopics = [...new Set(contentDna.filter((d) => d.topic).map((d) => d.topic as string))];
  const ourFormats = [...new Set(contentDna.filter((d) => d.format).map((d) => d.format as string))];

  const byName = new Map<string, typeof competitors[number]>();
  for (const c of competitors) byName.set(c.name.toLowerCase(), c);

  const observationsByCompetitor = new Map<string, typeof memories>();
  for (const m of memories) {
    const target = competitorRefFor(m.content, byName);
    if (!target) continue;
    const list = observationsByCompetitor.get(target.id) || [];
    list.push(m);
    observationsByCompetitor.set(target.id, list);
  }

  const analyzed: WarRoomCompetitor[] = [];
  for (const c of competitors) {
    const obs = (observationsByCompetitor.get(c.id) || []).map((m) => ({ content: m.content, createdAt: m.createdAt }));
    analyzed.push(await analyzeCompetitor({ competitor: c, observations: obs, ourTopics, ourFormats, userId }));
  }

  const allGaps = analyzed.flatMap((a) => a.gaps);
  const topGaps = [...new Set(allGaps)].slice(0, 6);
  const avgThreat = analyzed.length ? Math.round(analyzed.reduce((s, a) => s + a.threatScore, 0) / analyzed.length) : 0;

  const modelUsed = analyzed.find((a) => a.whyWinningProvider !== "deterministic" && a.whyWinningProvider !== "n/a");
  const splitProvider = modelUsed?.whyWinningProvider.split("@") ?? [];
  return {
    competitors: analyzed,
    generatedAt: new Date().toISOString(),
    analyzeModel: splitProvider[0] ?? null,
    analyzeProvider: splitProvider[1] ?? null,
    totalCompetitors: analyzed.length,
    avgThreat,
    topGapTopics: topGaps,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function competitorRefFor(content: string, byName: Map<string, { id: string }>): { id: string } | null {
  const lower = content.toLowerCase();
  for (const [name, comp] of byName) {
    if (lower.includes(name)) return comp;
    const short = name.split(" ")[0].toLowerCase();
    if (short.length > 2 && lower.includes(short)) return comp;
  }
  return null;
}

function topicGuess(content: string): string | null {
  const patterns = [
    /\btopic[: ]+([a-z0-9 ]{3,40})/i,
    /\bniche[: ]+([a-z0-9 ]{3,40})/i,
    /\bcovering[: ]+([a-z0-9 ]{3,40})/i,
    /\babout[: ]+([a-z0-9 ]{3,40})/i,
  ];
  for (const re of patterns) {
    const m = content.match(re);
    if (m) return m[1].toLowerCase().trim();
  }
  return null;
}

function shorten(s: string, n = 90): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function buildCounterStrategies(gaps: string[], ourFormats: string[], obsCount: number): string[] {
  if (obsCount === 0 && gaps.length === 0) return [];
  const strategies: string[] = [];
  if (gaps.length) strategies.push(`Close the content gap: publish our own take on "${gaps[0]}" with our distinct angle (never imitate).`);
  if (gaps[1]) strategies.push(`Differentiate by owning "${gaps[1]}" with deeper, first-party expertise.`);
  strategies.push(`Lean into our strongest format (${ourFormats[0] ?? "our current top performers"}) where they under-invest.`);
  strategies.push(`Emphasize our brand rules in every competitive post; signal distinct POV, not comparison spam.`);
  return strategies;
}

function deterministicWhy(name: string, observations: Array<{ content: string }>, patternKeys: string[], gaps: string[]): { text: string } {
  if (observations.length === 0 && patternKeys.length === 0) {
    return { text: "Insufficient data to judge why this competitor is winning." };
  }
  const bits: string[] = [];
  if (patternKeys.length) bits.push(`systematically posts around "${patternKeys.slice(0, 3).join("\", \"")}"`);
  if (observations.length) bits.push(`a steady stream of ${observations.length} observed moves`);
  if (gaps.length) bits.push(`owns topics we do not yet cover ("${gaps.slice(0, 2).join("\", \"")}")`);
  const anchor = bits.length ? bits.join(", ") : "consistent output";
  return { text: `${name} appears to win through ${anchor}. We should respond with differentiation, not imitation.` };
}

function buildBattlecard(c: { name: string; handle: string | null; platform: string | null; website: string | null }, threatScore: number, gaps: string[]): string[] {
  return [
    `Threat: ${threatLabel(threatScore)} (${threatScore}/100)`,
    c.platform ? `Active on: ${c.platform}` : `Platform: not recorded`,
    c.handle ? `Handle: ${c.handle}` : null,
    c.website ? `Website: ${c.website}` : null,
    gaps.length ? `Their ground: ${gaps.join(", ")}` : `Their ground: not yet mapped`,
    `Our posture: differentiate, own our angle, never copy`,
  ].filter(Boolean) as string[];
}

function tryJSON(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
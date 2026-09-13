import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/*
 * Adaptive Brain — Learning Intelligence pipeline.
 *
 * Turns raw events into structured insights (FACT / OBSERVATION / INFERENCE /
 * PREDICTION) that gain or lose confidence based on evidence, sample size and
 * time. Insight lifecycle: CANDIDATE → VALIDATED → ACTIVE → (STALE | REJECTED |
 * SUPERSEDED). This is retrieval/learning over the company's own data — not
 * model retraining. Pattern detection is deterministic; narrative generation
 * happens elsewhere (char/agents) on top of these insights.
 */

export type InsightType = "FACT" | "OBSERVATION" | "INFERENCE" | "PREDICTION";
export type InsightStatus = "CANDIDATE" | "VALIDATED" | "ACTIVE" | "STALE" | "REJECTED" | "SUPERSEDED";

export type LearningEventType =
  | "content_published"
  | "content_performance"
  | "approval_decision"
  | "competitor_observed"
  | "trend_observed"
  | "audience_signal"
  | "user_feedback";

const BASE_CONFIDENCE: Record<InsightType, number> = {
  FACT: 0.95,
  OBSERVATION: 0.72,
  INFERENCE: 0.55,
  PREDICTION: 0.38,
};

const VALIDATE_CONFIDENCE = 0.7; // CANDIDATE -> VALIDATED
const ACTIVATE_CONFIDENCE = 0.82; // VALIDATED -> ACTIVE
const ACTIVE_MIN_EVIDENCE = 2; // evidence points required to go ACTIVE
const STALE_CONFIDENCE = 0.3; // below this -> STALE
const STALE_AFTER_DAYS = 60; // no reinforcement in N days -> STALE
const HARD_CAP_DAYS = 365;

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Confidence = base(type), reinforced by evidence & sample size,
 * decayed by age and by days since last reinforcement.
 */
export function confidenceFor(input: {
  type: InsightType;
  evidenceCount: number;
  sampleSize: number;
  ageDays: number;
  lastReinforcedDays: number;
}): number {
  const { type, evidenceCount, sampleSize, ageDays, lastReinforcedDays } = input;
  const base = BASE_CONFIDENCE[type];

  const evidenceBoost = Math.min(0.12, evidenceCount * 0.03);
  const sampleBoost = sampleSize > 0 ? Math.min(0.08, Math.log10(sampleSize + 1) * 0.03) : 0;
  const ageDecay = Math.min(0.25, (ageDays / HARD_CAP_DAYS) * 0.25);
  const reinforceDecay = Math.min(0.2, (lastReinforcedDays / STALE_AFTER_DAYS) * 0.2);

  return clamp(base + evidenceBoost + sampleBoost - ageDecay - reinforceDecay);
}

async function upsertInsight(params: {
  companyId: string;
  type: InsightType;
  content: string;
  source: string;
  entityKind?: string | null;
  entityId?: string | null;
  dedupe: { entityKind: string; entityId?: string | null; type: InsightType };
  payload: Record<string, unknown>;
}) {
  const { companyId, type, content, source, entityKind, entityId, dedupe, payload } = params;

  const existing = await prisma.brainInsight.findFirst({
    where: {
      companyId,
      entityKind: dedupe.entityKind,
      entityId: dedupe.entityId ?? null,
      type,
      status: { not: "REJECTED" },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    const evidence = existing.evidenceCount + 1;
    const sample = existing.sampleSize + 1;
    await prisma.brainInsight.update({
      where: { id: existing.id },
      data: {
        confidence: confidenceFor({ type, evidenceCount: evidence, sampleSize: sample, ageDays: 0, lastReinforcedDays: 0 }),
        evidenceCount: evidence,
        sampleSize: sample,
        lastReinforcedAt: new Date(),
        payload: JSON.stringify(payload),
        content: existing.content,
      },
    });
    return existing.id;
  }

  const created = await prisma.brainInsight.create({
    data: {
      companyId,
      type,
      content,
      source,
      entityKind: entityKind ?? null,
      entityId: entityId ?? null,
      confidence: confidenceFor({ type, evidenceCount: 1, sampleSize: 1, ageDays: 0, lastReinforcedDays: 0 }),
      evidenceCount: 1,
      sampleSize: 1,
      status: "CANDIDATE",
      lastReinforcedAt: new Date(),
      payload: JSON.stringify(payload),
    },
  });
  return created.id;
}

/** Roll one event through the deterministic pattern detectors. */
export async function ingestEvent(params: {
  companyId: string;
  eventType: LearningEventType;
  payload: Record<string, unknown>;
  source?: string;
  dedupeKey?: string;
}): Promise<{ ingested: boolean; insights: string[] }> {
  const { companyId, eventType, payload, source, dedupeKey } = params;
  const insightIds: string[] = [];

  if (dedupeKey) {
    const seen = await prisma.learningEvent.findFirst({ where: { companyId, dedupeKey } });
    if (seen) return { ingested: false, insights: [] };
  }

  await prisma.learningEvent.create({
    data: {
      companyId,
      eventType,
      payload: JSON.stringify(payload),
      source: source ?? null,
      dedupeKey: dedupeKey ?? null,
      status: "PROCESSED",
      processedAt: new Date(),
    },
  });

  try {
    switch (eventType) {
      case "content_published": {
        const platform = (payload.platform as string) || "UNKNOWN";
        const contentType = (payload.contentType as string) || "POST";
        const hour = typeof payload.hour === "number" ? (payload.hour as number) : null;
        const day = (payload.day as string) || null;

        insightIds.push(
          await upsertInsight({
            companyId,
            type: "FACT",
            content: `Content published on ${platform} as ${contentType}${hour !== null ? ` at ${hour}:00` : ""}${day ? ` on ${day}` : ""}.`,
            source: source ?? "content_published",
            entityKind: "PUBLICATION",
            dedupe: { entityKind: "PUBLICATION", entityId: platform, type: "FACT" },
            payload,
          })
        );
        if (hour !== null) {
          insightIds.push(
            await upsertInsight({
              companyId,
              type: "OBSERVATION",
              content: `This audience sees content posted around ${hour}:00.`,
              source: source ?? "content_published",
              entityKind: "POSTING_TIME",
              entityId: `hour:${hour}`,
              dedupe: { entityKind: "POSTING_TIME", entityId: `hour:${hour}`, type: "OBSERVATION" },
              payload,
            })
          );
        }
        break;
      }

      case "content_performance": {
        const metric = (payload.metric as string) || "reach";
        const value = Number(payload.value ?? 0);
        const contentId = (payload.contentId as string) || null;
        const platform = (payload.platform as string) || null;
        const contentType = (payload.contentType as string) || null;
        const topic = (payload.topic as string) || null;

        // baseline of similar records this week
        const baseline = await prisma.performanceMetric.aggregate({
          where: { companyId, metric, createdAt: { gte: new Date(Date.now() - 7 * 864e5) } },
          _avg: { value: true },
        });
        const rel = baseline._avg.value ? value / baseline._avg.value : 1;

        if (topic) {
          insightIds.push(
            await upsertInsight({
              companyId,
              type: "INFERENCE",
              content:
                rel >= 1.25
                  ? `Topic "${topic}" consistently over-performs the weekly baseline (${(rel * 100).toFixed(0)}%).`
                  : rel <= 0.75
                    ? `Topic "${topic}" under-performs the weekly baseline (${(rel * 100).toFixed(0)}%).`
                    : `Topic "${topic}" performs in line with the weekly baseline.`,
              source: source ?? "content_performance",
              entityKind: "TOPIC",
              entityId: topic,
              dedupe: { entityKind: "TOPIC", entityId: topic, type: "INFERENCE" },
              payload,
            })
          );
        }
        if (contentType) {
          insightIds.push(
            await upsertInsight({
              companyId,
              type: "INFERENCE",
              content:
                rel >= 1.25
                  ? `${contentType} posts drive ${(rel * 100).toFixed(0)}% of baseline ${metric}.`
                  : `${contentType} posts under-perform on ${metric} vs baseline.`,
              source: source ?? "content_performance",
              entityKind: "FORMAT",
              entityId: contentType,
              dedupe: { entityKind: "FORMAT", entityId: contentType, type: "INFERENCE" },
              payload,
            })
          );
        }
        if (platform) {
          insightIds.push(
            await upsertInsight({
              companyId,
              type: "OBSERVATION",
              content: `Recent ${metric} on ${platform} is at ${(rel * 100).toFixed(0)}% of this week's baseline.`,
              source: source ?? "content_performance",
              entityKind: "PLATFORM",
              entityId: platform,
              dedupe: { entityKind: "PLATFORM", entityId: platform, type: "OBSERVATION" },
              payload,
            })
          );
        }
        void contentId;
        break;
      }

      case "approval_decision": {
        const decision = (payload.decision as string) || "approved";
        const platform = (payload.platform as string) || null;
        const contentType = (payload.contentType as string) || null;
        insightIds.push(
          await upsertInsight({
            companyId,
            type: "OBSERVATION",
            content: `Human reviewer ${decision} a ${contentType ?? "content"}${platform ? ` for ${platform}` : ""}.`,
            source: source ?? "approval_decision",
            entityKind: "APPROVAL",
            entityId: `${platform ?? "all"}:${contentType ?? "any"}`,
            dedupe: { entityKind: "APPROVAL", entityId: `${platform ?? "all"}:${contentType ?? "any"}`, type: "OBSERVATION" },
            payload,
          })
        );
        if (decision === "rejected" || decision === "request_changes") {
          const reason = (payload.reason as string) || null;
          if (reason) {
            insightIds.push(
              await upsertInsight({
                companyId,
                type: "OBSERVATION",
                content: `Reviewers repeatedly push back on "${reason}".`,
                source: source ?? "approval_decision",
                entityKind: "STYLE",
                entityId: reason,
                dedupe: { entityKind: "STYLE", entityId: reason, type: "OBSERVATION" },
                payload,
              })
            );
          }
        }
        break;
      }

      case "competitor_observed": {
        const name = (payload.name as string) || "unknown";
        const observation = (payload.observation as string) || "observed";
        insightIds.push(
          await upsertInsight({
            companyId,
            type: "FACT",
            content: `Competitor "${name}" ${observation}.`,
            source: source ?? "competitor_observed",
            entityKind: "COMPETITOR",
            entityId: name,
            dedupe: { entityKind: "COMPETITOR", entityId: name, type: "FACT" },
            payload,
          })
        );
        break;
      }

      case "trend_observed": {
        const title = (payload.title as string) || "a trend";
        const lifecycle = (payload.lifecycle as string) || "emerging";
        insightIds.push(
          await upsertInsight({
            companyId,
            type: "FACT",
            content: `Trend "${title}" tracked as ${lifecycle}.`,
            source: source ?? "trend_observed",
            entityKind: "TREND",
            entityId: title,
            dedupe: { entityKind: "TREND", entityId: title, type: "FACT" },
            payload,
          })
        );
        break;
      }

      case "audience_signal": {
        const signal = (payload.signal as string) || null;
        if (signal) {
          insightIds.push(
            await upsertInsight({
              companyId,
              type: "OBSERVATION",
              content: `Audience signal: ${signal}.`,
              source: source ?? "audience_signal",
              entityKind: "AUDIENCE",
              dedupe: { entityKind: "AUDIENCE", entityId: signal.slice(0, 80), type: "OBSERVATION" },
              payload,
            })
          );
        }
        break;
      }

      case "user_feedback": {
        const content = (payload.content as string) || "user correction";
        insightIds.push(
          await upsertInsight({
            companyId,
            type: "FACT",
            content: `Learned from user: ${content}`,
            source: source ?? "user_feedback",
            entityKind: "USER_KNOWLEDGE",
            dedupe: { entityKind: "USER_KNOWLEDGE", entityId: content.slice(0, 80), type: "FACT" },
            payload,
          })
        );
        break;
      }
    }
  } catch (e) {
    logger.error("ingestEvent failed", { ...logger.errorMeta(e), companyId, eventType });
    return { ingested: false, insights: [] };
  }

  return { ingested: insightIds.length > 0, insights: insightIds };
}

/** Recompute confidence for every insight after events arrive; promote milestone statuses. */
export async function reconcileInsights(companyId: string): Promise<number> {
  const now = new Date();
  const insights = await prisma.brainInsight.findMany({
    where: { companyId, status: { in: ["CANDIDATE", "VALIDATED", "ACTIVE"] } },
  });

  let changed = 0;
  for (const ins of insights) {
    const ageDays = (now.getTime() - ins.createdAt.getTime()) / 864e5;
    const lastReinforcedDays = Math.max(0, (now.getTime() - ins.lastReinforcedAt.getTime()) / 864e5);
    const confidence = confidenceFor({
      type: ins.type as InsightType,
      evidenceCount: ins.evidenceCount,
      sampleSize: ins.sampleSize,
      ageDays,
      lastReinforcedDays,
    });

    let status: InsightStatus = ins.status as InsightStatus;
    if (confidence < STALE_CONFIDENCE || lastReinforcedDays > STALE_AFTER_DAYS || ageDays > HARD_CAP_DAYS) {
      status = "STALE";
    } else if (ins.status === "CANDIDATE" && (confidence >= ACTIVATE_CONFIDENCE && ins.evidenceCount >= ACTIVE_MIN_EVIDENCE)) {
      status = "ACTIVE";
    } else if (ins.status === "CANDIDATE" && confidence >= VALIDATE_CONFIDENCE) {
      status = "VALIDATED";
    } else if (ins.status === "VALIDATED" && confidence >= ACTIVATE_CONFIDENCE && ins.evidenceCount >= ACTIVE_MIN_EVIDENCE) {
      status = "ACTIVE";
    } else if (ins.status === "ACTIVE" && confidence < VALIDATE_CONFIDENCE) {
      status = "VALIDATED";
    }

    if (status !== ins.status || confidence !== ins.confidence) {
      await prisma.brainInsight.update({
        where: { id: ins.id },
        data: { status, confidence: round4(confidence) },
      });
      changed++;
    }
  }

  return changed;
}

/** Promote the highest-confidence insights to the VERIFIED Memory fact layer. */
export async function promoteToMemories(companyId: string, limit = 3): Promise<string[]> {
  const candidates = await prisma.brainInsight.findMany({
    where: { companyId, status: "ACTIVE", relatedMemoryId: null, type: { in: ["FACT", "OBSERVATION"] } },
    orderBy: [{ confidence: "desc" }, { evidenceCount: "desc" }],
    take: limit,
  });

  const created: string[] = [];
  for (const c of candidates) {
    const memory = await prisma.memory.create({
      data: {
        companyId,
        type: "LEARNED_" + c.type,
        content: c.content,
        source: c.source ?? "adaptive-brain",
        provenance: JSON.stringify({ insightId: c.id, confidence: c.confidence, evidenceCount: c.evidenceCount }),
        confidence: c.confidence,
        verificationStatus: "VERIFIED",
      },
    });
    await prisma.brainInsight.update({ where: { id: c.id }, data: { relatedMemoryId: memory.id } });
    created.push(memory.id);
  }
  return created;
}

/** User feedback: verify (boost) / reject (kill) / correct (supersede + new FACT). */
export async function setInsightFeedback(params: {
  companyId: string;
  insightId: string;
  action: "verify" | "reject" | "correct";
  correction?: string;
}): Promise<{ id: string; status: InsightStatus; confidence: number }> {
  const { companyId, insightId, action, correction } = params;
  const insight = await prisma.brainInsight.findFirst({ where: { id: insightId, companyId } });
  if (!insight) throw Object.assign(new Error("Insight not found"), { status: 404 });

  let status: InsightStatus;
  let confidence = insight.confidence;
  let feedback: string | null = null;

  if (action === "verify") {
    status = insight.status === "ACTIVE" ? "ACTIVE" : "VALIDATED";
    confidence = clamp(confidence + 0.15);
    await prisma.brainInsight.update({ where: { id: insightId }, data: { lastReinforcedAt: new Date() } });
  } else if (action === "reject") {
    status = "REJECTED";
    confidence = 0;
    feedback = correction ?? "Rejected by user";
  } else {
    if (!correction) throw Object.assign(new Error("correction required for 'correct'"), { status: 400 });
    status = "SUPERSEDED";
    feedback = correction;
    await prisma.brainInsight.create({
      data: {
        companyId,
        type: "FACT",
        content: correction,
        source: "user_feedback",
        confidence: 0.95,
        evidenceCount: 1,
        sampleSize: 1,
        status: "ACTIVE",
        lastReinforcedAt: new Date(),
        entityKind: insight.entityKind,
        entityId: insight.entityId,
      },
    });
  }

  const updated = await prisma.brainInsight.update({
    where: { id: insightId },
    data: { status, confidence: status === "REJECTED" ? 0 : confidence, feedback },
  });
  return { id: updated.id, status: updated.status as InsightStatus, confidence: round4(updated.confidence) };
}

export async function getInsights(companyId: string, opts?: { status?: InsightStatus; limit?: number }) {
  return prisma.brainInsight.findMany({
    where: { companyId, ...(opts?.status ? { status: opts.status } : {}) },
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
    take: opts?.limit ?? 50,
  });
}

/**
 * Decision engine — ranks ACTIVE / VALIDATED insights by confidence & impact
 * to produce a next-best-action. Every action is backed by a specific insight
 * (evidence), so recommendations are auditable rather than aspirational.
 */
export async function recommendNextActions(companyId: string, limit = 5) {
  const insights = await prisma.brainInsight.findMany({
    where: { companyId, status: { in: ["ACTIVE", "VALIDATED"] } },
    orderBy: [{ confidence: "desc" }, { evidenceCount: "desc" }],
  });

  const IMPACT: Record<string, number> = {
    TOPIC: 0.9,
    FORMAT: 0.85,
    POSTING_TIME: 0.75,
    PLATFORM: 0.7,
    STYLE: 0.65,
    COMPETITOR: 0.6,
    AUDIENCE: 0.55,
    TREND: 0.5,
    PUBLICATION: 0.4,
    APPROVAL: 0.3,
    USER_KNOWLEDGE: 0.9,
  };

  return insights
    .map((ins) => {
      const entityKind = (ins.entityKind || "GENERAL") as string;
      const impact = IMPACT[entityKind] ?? 0.5;
      const score = round4((ins.confidence || 0) * impact);
      let title = "Follow the strongest signal";
      if (entityKind === "TOPIC") title = `Double down on this winning topic`;
      else if (entityKind === "FORMAT") title = `Publish more ${ins.entityId} content`;
      else if (entityKind === "POSTING_TIME") title = `Post near ${ins.entityId} for best visibility`;
      else if (entityKind === "PLATFORM") title = `Increase cadence on ${ins.entityId}`;
      else if (entityKind === "COMPETITOR") title = `Tighten positioning vs ${ins.entityId}`;
      else if (entityKind === "STYLE") title = `Reduce "${ins.entityId}" friction in drafts`;
      else if (entityKind === "AUDIENCE") title = `Serve the audience signal about ${ins.entityId ?? "your niche"}`;
      else if (entityKind === "TREND") title = `Ride "${ins.entityId}" while it is rising`;
      return {
        id: ins.id,
        title,
        reasoning: ins.content,
        evidence: { confidence: round4(ins.confidence), evidenceCount: ins.evidenceCount, sampleSize: ins.sampleSize, insightType: ins.type },
        expectedImpact: impact,
        priorityScore: score,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit);
}

/** Summarize the brain's active knowledge for prompts. */
export async function learningSummary(companyId: string, limit = 6): Promise<string[]> {
  const insights = await prisma.brainInsight.findMany({
    where: { companyId, status: { in: ["ACTIVE", "VALIDATED"] }, type: { in: ["FACT", "OBSERVATION", "INFERENCE"] } },
    orderBy: [{ confidence: "desc" }, { evidenceCount: "desc" }],
    take: limit,
  });
  return insights.map((i) => `[${i.type} c=${round4(i.confidence).toFixed(2)} e=${i.evidenceCount}] ${i.content}`);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
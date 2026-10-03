import { prisma } from "@/lib/db";
import { suggestReply, type MessageTone } from "@/lib/intelligence/intent";

/**
 * Crisis / spike detection over the social inbox (closes matrix gap F64).
 * Purely computed from real InboxMessage rows — no new tables, no mocks.
 */

export interface CrisisStatus {
  alert: boolean;
  negatives: number;
  windowMin: number;
  threshold: number;
  latestAt: string | null;
}

export async function detectCrisis(
  companyId: string,
  opts?: { windowMin?: number; threshold?: number }
): Promise<CrisisStatus> {
  const windowMin = opts?.windowMin ?? 60;
  const threshold = opts?.threshold ?? 3;
  const since = new Date(Date.now() - windowMin * 60_000);
  const negatives = await prisma.inboxMessage.findMany({
    where: { companyId, sentiment: "negative", createdAt: { gte: since } },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: threshold + 20,
  });
  return {
    alert: negatives.length >= threshold,
    negatives: negatives.length,
    windowMin,
    threshold,
    latestAt: negatives[0]?.createdAt.toISOString() ?? null,
  };
}

export interface AutoDraftResult {
  drafted: number;
  ids: string[];
}

/** Draft deterministic reply suggestions for unread messages that lack one. */
export async function autoDraftUnread(companyId: string, limit = 10): Promise<AutoDraftResult> {
  const pending = await prisma.inboxMessage.findMany({
    where: { companyId, status: "unread", aiSuggestion: null },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 25)),
  });
  const ids: string[] = [];
  for (const m of pending) {
    const local = suggestReply({
      sentiment: (m.sentiment || "neutral") as MessageTone["sentiment"],
      intent: (m.intent || "general") as MessageTone["intent"],
      platform: m.platform,
      channelType: m.channelType,
    });
    const text = local?.text ?? "Thanks for reaching out — we'll look into it.";
    await prisma.inboxMessage.update({
      where: { id: m.id },
      data: { aiSuggestion: text.slice(0, 500), aiSuggestionTone: "template-batch" },
    });
    ids.push(m.id);
  }
  return { drafted: ids.length, ids };
}

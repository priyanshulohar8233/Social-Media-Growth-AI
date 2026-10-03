import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { detectCrisis, autoDraftUnread } from "@/lib/intelligence/crisis";
import { auditLog, getClientIp } from "@/lib/audit";

/** Crisis status + unread queue overview (computed from real inbox rows). */
export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertMembership(auth.userId, companyId);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const url = new URL(request.url);
  const windowMin = Math.max(5, Math.min(Number(url.searchParams.get("windowMin")) || 60, 1440));
  const threshold = Math.max(1, Math.min(Number(url.searchParams.get("threshold")) || 3, 50));

  const [crisis, unreadByIntent, unanswered] = await Promise.all([
    detectCrisis(companyId, { windowMin, threshold }),
    prisma.inboxMessage.groupBy({ by: ["intent"], where: { companyId, status: "unread" }, _count: true }),
    prisma.inboxMessage.count({ where: { companyId, status: "unread", aiSuggestion: null } }),
  ]);

  return NextResponse.json({
    crisis,
    unreadByIntent: unreadByIntent.map((r) => ({ intent: r.intent, count: r._count })),
    unanswered,
  });
}

/** Auto-draft reply suggestions for unread messages (deterministic templates). */
export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertMembership(auth.userId, companyId);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const result = await autoDraftUnread(companyId, 10);
  await auditLog({
    companyId,
    userId: auth.userId,
    action: "inbox.auto-draft",
    entity: "InboxMessage",
    meta: { drafted: result.drafted },
    ip: getClientIp(request),
  });
  return NextResponse.json({ success: true, data: result });
}

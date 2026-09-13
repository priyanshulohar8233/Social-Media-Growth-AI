import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { assertPermission } from "@/lib/rbac";
import { ingestEvent } from "@/lib/brain/learn";
import { auditLog, getClientIp } from "@/lib/audit";

const ALLOWED_EVENT_TYPES = [
  "content_published",
  "content_performance",
  "approval_decision",
  "competitor_observed",
  "trend_observed",
  "audience_signal",
  "user_feedback",
] as const;

// Ingestion endpoint for the Adaptive Brain learning pipeline.
// Event types are validated; payloads are stored as provenance (never executed).
export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertPermission(auth.userId, companyId, "memory.manage"); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { eventType, payload, dedupeKey, source } = body as {
    eventType?: string;
    payload?: Record<string, unknown>;
    dedupeKey?: string;
    source?: string;
  };

  if (!eventType || !ALLOWED_EVENT_TYPES.includes(eventType as (typeof ALLOWED_EVENT_TYPES)[number])) {
    return NextResponse.json({ error: `eventType must be one of: ${ALLOWED_EVENT_TYPES.join(", ")}` }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "payload (object) required" }, { status: 400 });
  }

  const result = await ingestEvent({
    companyId,
    eventType: eventType as (typeof ALLOWED_EVENT_TYPES)[number],
    payload,
    dedupeKey,
    source: source ?? "api",
  });

  await auditLog({
    companyId,
    userId: auth.userId,
    action: "brain.event.ingest",
    entity: "LearningEvent",
    entityId: dedupeKey ?? undefined,
    meta: { eventType, ingested: result.ingested },
    ip: getClientIp(request),
  });

  return NextResponse.json(result, { status: result.ingested ? 201 : 200 });
}
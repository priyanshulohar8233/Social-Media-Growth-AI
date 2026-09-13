import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { assertPermission } from "@/lib/rbac";
import { auditLog, getClientIp } from "@/lib/audit";
import { ingestEvent } from "@/lib/brain/learn";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const { companyId, id } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertMembership(auth.userId, companyId);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const approval = await prisma.approval.findFirst({
    where: { id, companyId },
    include: {
      content: { select: { id: true, title: true, platform: true, status: true } },
      reviewer: { select: { id: true, name: true, email: true } },
      requester: { select: { id: true, name: true } },
    },
  });
  if (!approval) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  return NextResponse.json({ approval });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const { companyId, id } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertMembership(auth.userId, companyId);
    await assertPermission(auth.userId, companyId, "approval.manage");
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const approval = await prisma.approval.findFirst({ where: { id, companyId }, include: { content: true } });
  if (!approval) return NextResponse.json({ error: "Approval not found" }, { status: 404 });

  const body = await request.json();
  const { action, comments } = body as { action?: string; comments?: string };

  let approvalStatus: string;
  let contentStatus: string | null = null;

  switch (action) {
    case "approve":
      approvalStatus = "APPROVED";
      contentStatus = "APPROVED";
      break;
    case "reject":
      approvalStatus = "REJECTED";
      contentStatus = "REJECTED";
      break;
    case "request_changes":
      approvalStatus = "CHANGES_REQUESTED";
      contentStatus = "NEEDS_REVISION";
      break;
    default:
      return NextResponse.json({ error: "Invalid action — use approve | reject | request_changes" }, { status: 400 });
  }

  const updated = await prisma.approval.update({
    where: { id },
    data: { status: approvalStatus, reviewedBy: auth.userId, comments: comments || null },
    include: { content: { select: { id: true, title: true, status: true } } },
  });

  if (contentStatus && approval.content) {
    await prisma.content.update({ where: { id: approval.contentId }, data: { status: contentStatus } });
  }

  // Verified learning: record what was approved so the brain can reuse it.
  if (action === "approve" && approval.content) {
    await prisma.memory.create({
      data: {
        companyId,
        type: "DECISION_HISTORY",
        content: `Approved post: ${approval.content.title} (${approval.content.platform})${comments ? ` — ${comments}` : ""}`,
        source: `approval:${id}`,
        verificationStatus: "VERIFIED",
        confidence: 0.9,
      },
    });
  }

  // Feed the Adaptive Brain — the human decision is a learning event
  await ingestEvent({
    companyId,
    eventType: "approval_decision",
    payload: {
      decision: action,
      reason: comments || null,
      platform: approval.content?.platform ?? null,
      contentType: approval.content?.contentType ?? null,
      contentId: approval.contentId,
    },
    source: `approval:${id}`,
    dedupeKey: `approval_decision:${id}`,
  });

  await auditLog({ companyId, userId: auth.userId, action: `approval.${action}`, entity: "Approval", entityId: id, ip: getClientIp(request) });
  return NextResponse.json({ approval: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const { companyId, id } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertMembership(auth.userId, companyId);
    await assertPermission(auth.userId, companyId, "approval.manage");
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const existing = await prisma.approval.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Approval not found" }, { status: 404 });

  await prisma.approval.delete({ where: { id } });
  await auditLog({ companyId, userId: auth.userId, action: "approval.delete", entity: "Approval", entityId: id, ip: getClientIp(request) });
  return NextResponse.json({ success: true });
}
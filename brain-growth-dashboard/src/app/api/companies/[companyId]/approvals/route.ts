import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { auditLog, getClientIp } from "@/lib/audit";

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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;

  const approvals = await prisma.approval.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { content: { select: { id: true, title: true, platform: true, status: true } } },
    take: 50,
  });

  return NextResponse.json({ approvals });
}

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

  const body = await request.json();
  const { contentId, action, comments } = body as { contentId?: string; action?: string; comments?: string };
  if (!contentId || !action) return NextResponse.json({ error: "contentId and action required" }, { status: 400 });

  const content = await prisma.content.findFirst({ where: { id: contentId, companyId } });
  if (!content) return NextResponse.json({ error: "Content not found or wrong company" }, { status: 404 });

  let approvalStatus: string;
  let contentStatus: string | null = null;

  if (action === "approve") {
    approvalStatus = "APPROVED";
    contentStatus = "APPROVED";
  } else if (action === "reject") {
    approvalStatus = "REJECTED";
    contentStatus = "REJECTED";
  } else if (action === "request_changes") {
    approvalStatus = "CHANGES_REQUESTED";
    contentStatus = "NEEDS_REVISION";
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const approval = await prisma.approval.upsert({
    where: { id: contentId }, // try by contentId not exists, so create
    update: { status: approvalStatus, reviewedBy: auth.userId, comments: comments || null },
    create: { companyId, contentId, requestedBy: auth.userId, reviewedBy: auth.userId, status: approvalStatus, comments: comments || null },
  }).catch(async () => {
    // fallback: find existing approval for this content
    const existing = await prisma.approval.findFirst({ where: { contentId, companyId } });
    if (existing) {
      return prisma.approval.update({ where: { id: existing.id }, data: { status: approvalStatus, reviewedBy: auth.userId, comments: comments || null } });
    }
    return prisma.approval.create({ data: { companyId, contentId, requestedBy: auth.userId, reviewedBy: auth.userId, status: approvalStatus, comments: comments || null } });
  });

  if (contentStatus) {
    await prisma.content.update({ where: { id: contentId }, data: { status: contentStatus } });
  }

  // Verified learning on approval
  if (action === "approve") {
    await prisma.memory.create({
      data: {
        companyId,
        type: "DECISION_HISTORY",
        content: `Content approved: ${content.title} — approved by user`,
        source: `content:${contentId}`,
        verificationStatus: "VERIFIED",
        confidence: 0.9,
      },
    });
  }

  await auditLog({ companyId, userId: auth.userId, action: `approval.${action}`, entity: "Approval", entityId: approval.id, ip: getClientIp(request) });

  return NextResponse.json({ approval });
}

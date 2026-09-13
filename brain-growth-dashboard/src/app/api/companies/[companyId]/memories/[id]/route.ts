import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { assertPermission } from "@/lib/rbac";
import { auditLog, getClientIp } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const { companyId, id } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertMembership(auth.userId, companyId);
    await assertPermission(auth.userId, companyId, "memory.manage");
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const existing = await prisma.memory.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { type, content, confidence, verificationStatus, source } = body as {
    type?: string;
    content?: string;
    confidence?: number;
    verificationStatus?: string;
    source?: string;
  };

  const data: Record<string, unknown> = {};
  if (typeof type === "string" && type.trim()) data.type = type.trim().slice(0, 100);
  if (typeof content === "string" && content.trim()) data.content = content.trim().slice(0, 4000);
  if (typeof confidence === "number" && confidence >= 0 && confidence <= 1) data.confidence = confidence;
  if (typeof source === "string") data.source = source.trim() || null;
  if (typeof verificationStatus === "string" && ["PENDING", "VERIFIED", "REJECTED"].includes(verificationStatus)) {
    data.verificationStatus = verificationStatus;
    if (verificationStatus === "VERIFIED") {
      data.verifiedBy = auth.userId;
      data.verifiedAt = new Date();
    } else if (verificationStatus === "REJECTED") {
      data.verifiedBy = null;
      data.verifiedAt = null;
    }
  }

  const memory = await prisma.memory.update({ where: { id }, data });
  await auditLog({ companyId, userId: auth.userId, action: "memory.update", entity: "Memory", entityId: id, ip: getClientIp(request) });
  return NextResponse.json({ memory });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const { companyId, id } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertMembership(auth.userId, companyId);
    await assertPermission(auth.userId, companyId, "memory.manage");
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const existing = await prisma.memory.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.memory.delete({ where: { id } });
  await auditLog({ companyId, userId: auth.userId, action: "memory.delete", entity: "Memory", entityId: id, ip: getClientIp(request) });
  return NextResponse.json({ success: true });
}
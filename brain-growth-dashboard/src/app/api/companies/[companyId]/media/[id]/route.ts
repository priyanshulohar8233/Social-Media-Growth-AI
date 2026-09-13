import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { assertPermission } from "@/lib/rbac";
import { auditLog, getClientIp } from "@/lib/audit";

export async function DELETE(request: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const { companyId, id } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertPermission(auth.userId, companyId, "content.delete"); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const asset = await prisma.mediaAsset.findFirst({ where: { id, companyId } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.mediaAsset.delete({ where: { id } });
  await auditLog({ companyId, userId: auth.userId, action: "media.delete", entity: "MediaAsset", entityId: id, ip: getClientIp(request) });
  return NextResponse.json({ ok: true });
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { auditLog, getClientIp } from "@/lib/audit";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "contacted", "qualified", "won", "lost"];

export async function PATCH(request: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const { companyId, id } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const existing = await prisma.lead.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const body = await request.json();
  const { status, value } = body as { status?: string; value?: number };

  const data: Record<string, unknown> = {};
  if (typeof status === "string" && STATUSES.includes(status)) data.status = status;
  if (typeof value === "number" && value >= 0) {
    const meta = existing.meta ? safeParse(existing.meta) : {};
    data.meta = JSON.stringify({ ...meta, dealValue: value });
  }

  const lead = await prisma.lead.update({ where: { id }, data });

  // Won lead → record a conversion (source of truth for ROI).
  if (data.status === "won") {
    await prisma.conversion.create({ data: { companyId, leadId: id, value: typeof value === "number" ? value : null } });
    await auditLog({ companyId, userId: auth.userId, action: "lead.won", entity: "Lead", entityId: id, ip: getClientIp(request) });
  }

  return NextResponse.json({ lead });
}

function safeParse(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const { companyId, id } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const existing = await prisma.lead.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  await prisma.lead.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { auditLog, getClientIp } from "@/lib/audit";

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }
  const deals = await prisma.brandDeal.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ brandDeals: deals });
}

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }
  const body = await request.json();
  const { brand, campaign, deliverables, platform, deadline, compensation } = body as { brand: string; campaign?: string; deliverables?: unknown; platform?: string; deadline?: string; compensation?: string };
  if (!brand) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const deal = await prisma.brandDeal.create({
    data: { companyId, brand, campaign: campaign || null, deliverables: deliverables ? JSON.stringify(deliverables) : null, platform: platform || null, deadline: deadline ? new Date(deadline) : null, compensation: compensation || null, status: "pending" },
  });
  await auditLog({ companyId, userId: auth.userId, action: "brandDeal.create", entity: "BrandDeal", entityId: deal.id, ip: getClientIp(request) });
  return NextResponse.json({ brandDeal: deal }, { status: 201 });
}

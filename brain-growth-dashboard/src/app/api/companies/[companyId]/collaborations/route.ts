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
  const collaborations = await prisma.collaboration.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ collaborations });
}

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }
  const body = await request.json();
  const { partnerName, partnerHandle, niche, idea } = body as { partnerName: string; partnerHandle?: string; niche?: string; idea?: string };
  if (!partnerName) return NextResponse.json({ error: "partnerName required" }, { status: 400 });

  // Creator growth: match score based on niche overlap (mock)
  const matchScore = niche ? 0.75 : 0.6;

  const collab = await prisma.collaboration.create({
    data: { companyId, partnerName, partnerHandle: partnerHandle || null, niche: niche || null, matchScore, idea: idea || null, status: "proposed" },
  });
  await auditLog({ companyId, userId: auth.userId, action: "collaboration.create", entity: "Collaboration", entityId: collab.id, ip: getClientIp(request) });
  return NextResponse.json({ collaboration: collab }, { status: 201 });
}

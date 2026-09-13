import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { createCompetitorSchema } from "@/lib/validators";
import { ingestEvent } from "@/lib/brain/learn";

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }
  const competitors = await prisma.competitor.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ competitors });
}

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }
  const body = await request.json();
  const parsed = createCompetitorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const competitor = await prisma.competitor.create({ data: { companyId, name: parsed.data.name, handle: parsed.data.handle || null, platform: parsed.data.platform || null, website: parsed.data.website || null, notes: parsed.data.notes || null } });
  await prisma.memory.create({
    data: { companyId, type: "COMPETITOR_OBSERVATION", content: `Competitor added: ${competitor.name}`, source: `competitor:${competitor.id}`, verificationStatus: "PENDING" },
  });
  await ingestEvent({
    companyId,
    eventType: "competitor_observed",
    payload: { name: competitor.name, observation: "added to tracking" },
    source: `competitor:${competitor.id}`,
    dedupeKey: `competitor_observed:${competitor.id}`,
  });
  return NextResponse.json({ competitor }, { status: 201 });
}

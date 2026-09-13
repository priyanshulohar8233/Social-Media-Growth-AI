import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { createTrendSchema } from "@/lib/validators";
import { ingestEvent } from "@/lib/brain/learn";

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }
  const trends = await prisma.trend.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ trends });
}

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }
  const body = await request.json();
  const parsed = createTrendSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const trend = await prisma.trend.create({ data: { companyId, ...parsed.data, lifecycle: parsed.data.lifecycle || "emerging" } });
  // Also create memory observation
  await prisma.memory.create({
    data: { companyId, type: "TREND_OBSERVATION", content: `Trend: ${trend.title} — ${trend.description || ""}`, source: `trend:${trend.id}`, verificationStatus: "PENDING", confidence: 0.6 },
  });
  await ingestEvent({
    companyId,
    eventType: "trend_observed",
    payload: { title: trend.title, lifecycle: trend.lifecycle, relevance: trend.relevance ?? null },
    source: `trend:${trend.id}`,
    dedupeKey: `trend_observed:${trend.id}`,
  });
  return NextResponse.json({ trend }, { status: 201 });
}

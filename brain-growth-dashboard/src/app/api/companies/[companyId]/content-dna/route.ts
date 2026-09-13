import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const dnas = await prisma.contentDna.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 30 });
  // Also derive from top performing content if none exist
  if (dnas.length === 0) {
    const top = await prisma.content.findMany({ where: { companyId, status: "PUBLISHED" }, take: 5, orderBy: { createdAt: "desc" } });
    const derived = top.map((c) => ({
      id: `derived-${c.id}`,
      companyId,
      contentId: c.id,
      hook: c.hook || "strong hook",
      topic: c.title.slice(0, 50),
      format: c.contentType,
      visualStyle: c.visualPrompt?.slice(0, 100) || null,
      cta: c.cta,
      timing: null,
      outcome: JSON.stringify({ views: 0 }),
      createdAt: c.createdAt,
    }));
    return NextResponse.json({ contentDnas: [...dnas, ...derived] });
  }
  return NextResponse.json({ contentDnas: dnas });
}

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const body = await request.json();
  const { contentId, hook, topic, format, visualStyle, cta, outcome } = body as { contentId?: string; hook?: string; topic?: string; format?: string; visualStyle?: string; cta?: string; outcome?: unknown };
  const dna = await prisma.contentDna.create({
    data: { companyId, contentId: contentId || null, hook: hook || null, topic: topic || null, format: format || null, visualStyle: visualStyle || null, cta: cta || null, outcome: outcome ? JSON.stringify(outcome) : null },
  });
  await prisma.memory.create({
    data: { companyId, type: "CONTENT_DNA", content: `Content DNA: hook=${hook} topic=${topic} format=${format}`, source: `contentDna:${dna.id}`, verificationStatus: "VERIFIED", confidence: 0.85 },
  });
  return NextResponse.json({ dna }, { status: 201 });
}

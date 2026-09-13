import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";

/** List leads with status filter + aggregate conversion value. */
export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;

  const [leads, byStatus, conversions] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.lead.groupBy({ by: ["status"], _count: { id: true }, where: { companyId } }),
    prisma.conversion.aggregate({ where: { companyId }, _sum: { value: true }, _count: { id: true } }),
  ]);

  return NextResponse.json({ leads, byStatus, conversions: { total: conversions._count.id, value: conversions._sum.value ?? 0 } });
}

/** Create a lead. */
export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const body = await request.json();
  const { name, email, source, meta } = body as { name?: string; email?: string; source?: string; meta?: Record<string, unknown> };
  if (!name && !email) return NextResponse.json({ error: "name or email required" }, { status: 400 });

  const lead = await prisma.lead.create({
    data: { companyId, name: name || null, email: email || null, source: source || "manual", status: "new", meta: meta ? JSON.stringify(meta) : null },
  });
  return NextResponse.json({ lead }, { status: 201 });
}
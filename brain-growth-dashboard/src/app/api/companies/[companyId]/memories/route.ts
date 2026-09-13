import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { createMemorySchema } from "@/lib/validators";
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
  const type = searchParams.get("type");
  const verificationStatus = searchParams.get("verificationStatus");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  const where: Record<string, unknown> = { companyId };
  if (type) where.type = type;
  if (verificationStatus) where.verificationStatus = verificationStatus;

  const memories = await prisma.memory.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ memories });
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
  const parsed = createMemorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const data = parsed.data;

  // Enforce verification: external unverified info must not become trusted automatically
  // If source is external and verificationStatus is not explicitly VERIFIED, force PENDING
  let verificationStatus = data.verificationStatus || "PENDING";
  if (data.source && data.source.startsWith("external:") && verificationStatus === "VERIFIED") {
    // require explicit approval — downgrade to PENDING unless user is OWNER/ADMIN verifying
    const membership = await prisma.membership.findUnique({
      where: { userId_companyId: { userId: auth.userId, companyId } },
    });
    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      verificationStatus = "PENDING";
    }
  }

  const memory = await prisma.memory.create({
    data: {
      companyId,
      type: data.type,
      content: data.content,
      source: data.source || null,
      provenance: data.provenance ? JSON.stringify({ raw: data.provenance }) : null,
      confidence: data.confidence ?? 0.8,
      verificationStatus,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });

  await auditLog({
    companyId,
    userId: auth.userId,
    action: "memory.create",
    entity: "Memory",
    entityId: memory.id,
    ip: getClientIp(request),
    meta: { type: memory.type, verificationStatus },
  });

  return NextResponse.json({ memory }, { status: 201 });
}

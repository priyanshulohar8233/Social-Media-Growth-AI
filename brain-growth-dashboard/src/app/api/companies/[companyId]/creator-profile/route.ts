import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { updateCreatorProfileSchema } from "@/lib/validators";
import { auditLog, getClientIp } from "@/lib/audit";

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }
  const profile = await prisma.creatorProfile.findUnique({ where: { companyId } });
  return NextResponse.json({ profile });
}

export async function PUT(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const body = await request.json();
  const parsed = updateCreatorProfileSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const profile = await prisma.creatorProfile.upsert({
    where: { companyId },
    update: parsed.data,
    create: { companyId, ...parsed.data },
  });

  // Handle contentPillars as separate table if provided as comma-separated or JSON
  if (parsed.data.contentPillars) {
    try {
      const pillars = JSON.parse(parsed.data.contentPillars);
      if (Array.isArray(pillars)) {
        await prisma.contentPillar.deleteMany({ where: { companyId } });
        for (const name of pillars.slice(0, 10)) {
          if (typeof name === "string" && name.trim()) {
            await prisma.contentPillar.create({ data: { companyId, name: name.trim(), creatorProfileId: profile.id } });
          }
        }
      }
    } catch {
      // treat as comma-separated
      const list = parsed.data.contentPillars.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length) {
        await prisma.contentPillar.deleteMany({ where: { companyId } });
        for (const name of list.slice(0, 10)) {
          await prisma.contentPillar.create({ data: { companyId, name, creatorProfileId: profile.id } });
        }
      }
    }
  }

  await auditLog({ companyId, userId: auth.userId, action: "creator.profile.update", entity: "CreatorProfile", entityId: profile.id, ip: getClientIp(request) });
  return NextResponse.json({ profile });
}

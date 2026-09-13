import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, ensureUniqueSlug } from "@/lib/auth-server";
import { createCompanySchema } from "@/lib/validators";
import { auditLog, getClientIp } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await prisma.membership.findMany({
    where: { userId: auth.userId },
    include: {
      company: {
        select: { id: true, name: true, slug: true, industry: true, website: true, profileType: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ companies: memberships.map((m) => ({ ...m.company, role: m.role })) });
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "Session expired or invalid user. Please sign in again." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createCompanySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { name, industry, website, description, profileType, creatorNiche, contentNiche, creatorGoals } = parsed.data;
  const slug = await ensureUniqueSlug(name);
  const pt = profileType || "BUSINESS";

  const company = await prisma.company.create({
    data: {
      name,
      slug,
      industry: industry || null,
      website: website || null,
      description: description || null,
      profileType: pt,
      memberships: { create: { userId: auth.userId, role: "OWNER" } },
      // Pure creators get a CreatorProfile only; business/personal-brand
      // workspaces also get a CompanyProfile (upserted on later PUTs).
      ...(pt !== "CREATOR" ? { profile: { create: {} } } : {}),
      ...(pt === "CREATOR" || pt === "PERSONAL_BRAND"
        ? {
            creatorProfile: {
              create: {
                creatorNiche: creatorNiche || null,
                contentNiche: contentNiche || null,
                creatorGoals: creatorGoals || null,
              },
            },
          }
        : {}),
    },
    select: { id: true, name: true, slug: true, industry: true, website: true, profileType: true },
  });

  await auditLog({
    companyId: company.id,
    userId: auth.userId,
    action: "company.create",
    entity: "Company",
    entityId: company.id,
    ip: getClientIp(request),
    meta: { name },
  });

  return NextResponse.json({ company }, { status: 201 });
}

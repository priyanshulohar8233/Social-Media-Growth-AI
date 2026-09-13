import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const channels = await prisma.monetizationChannel.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });

  // Creator monetization intelligence — generate opportunities from context
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { profileType: true } });
  const creatorProfile = await prisma.creatorProfile.findUnique({ where: { companyId } });
  const opportunities: Array<{ type: string; title: string; description: string; estimatedValue: string }> = [];

  if (company?.profileType === "CREATOR" || company?.profileType === "PERSONAL_BRAND") {
    const niche = creatorProfile?.creatorNiche || "general";
    opportunities.push(
      { type: "sponsorship", title: `Sponsorship: ${niche} brands`, description: `Brands in ${niche} seek creators with your audience`, estimatedValue: "Estimate: varies" },
      { type: "affiliate", title: "Affiliate: niche products", description: "Recommend products aligned to content pillars", estimatedValue: "Estimate: commission-based" },
      { type: "digital_product", title: "Digital product", description: "Course/template based on top content DNA", estimatedValue: "Estimate: depends on audience size" }
    );
  } else {
    opportunities.push(
      { type: "campaign", title: "Lead generation campaign", description: "Convert social reach to leads", estimatedValue: "Estimate: ROI varies" }
    );
  }

  return NextResponse.json({ channels, opportunities });
}

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const body = await request.json();
  const { type, description } = body as { type: string; description?: string };
  if (!type) return NextResponse.json({ error: "type required" }, { status: 400 });
  const channel = await prisma.monetizationChannel.create({ data: { companyId, type, description: description || null } });
  return NextResponse.json({ channel }, { status: 201 });
}

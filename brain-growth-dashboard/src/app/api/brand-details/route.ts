import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { brandDetailsSchema } from "@/lib/validators";
import { auditLog, getClientIp } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized request" } },
      { status: 401 }
    );
  }

  try {
    const brand = await prisma.brandDetail.findFirst({
      where: { userId: auth.userId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: brand
        ? {
            id: brand.id,
            businessType: brand.businessType,
            industry: brand.industry || "",
            contentType: brand.contentType,
            goal: brand.goal,
            website: brand.website || "",
            createdAt: brand.createdAt,
            updatedAt: brand.updatedAt,
          }
        : null,
    });
  } catch (e) {
    console.error("[GET /api/brand-details]", e);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch brand details" } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return upsertBrandDetails(request);
}

export async function PUT(request: Request) {
  return upsertBrandDetails(request);
}

export async function PATCH(request: Request) {
  return upsertBrandDetails(request);
}

async function upsertBrandDetails(request: Request) {
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized request" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = brandDetailsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0].message,
            errors: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const { businessType, industry, contentType, goal, website } = parsed.data;

    // Check if brand detail exists for user
    const existing = await prisma.brandDetail.findFirst({
      where: { userId: auth.userId },
    });

    let brand;
    if (existing) {
      brand = await prisma.brandDetail.update({
        where: { id: existing.id },
        data: {
          businessType,
          industry: businessType === "Company" ? (industry || null) : null,
          contentType,
          goal,
          website: website || null,
        },
      });
    } else {
      brand = await prisma.brandDetail.create({
        data: {
          userId: auth.userId,
          businessType,
          industry: businessType === "Company" ? (industry || null) : null,
          contentType,
          goal,
          website: website || null,
        },
      });
    }

    // Advance onboarding step to TOUR if user was on BRAND_DETAILS or previous steps
    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (user && user.onboardingStep !== "COMPLETED") {
      await prisma.user.update({
        where: { id: auth.userId },
        data: { onboardingStep: "TOUR" },
      });
    }

    // Sync or create company profile details if user has a workspace
    const membership = await prisma.membership.findFirst({
      where: { userId: auth.userId },
      include: { company: true },
    });

    if (membership?.companyId) {
      await prisma.company.update({
        where: { id: membership.companyId },
        data: {
          industry: businessType === "Company" ? (industry || null) : null,
          website: website || null,
          profileType: businessType === "Company" ? "BUSINESS" : "PERSONAL_BRAND",
        },
      });
    }

    await auditLog({
      userId: auth.userId,
      companyId: membership?.companyId || null,
      action: "BRAND_DETAILS_UPDATED",
      entity: "BrandDetail",
      entityId: brand.id,
      ip: getClientIp(request),
      meta: { businessType, industry, contentType, goal },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: brand.id,
        businessType: brand.businessType,
        industry: brand.industry || "",
        contentType: brand.contentType,
        goal: brand.goal,
        website: brand.website || "",
        createdAt: brand.createdAt,
        updatedAt: brand.updatedAt,
      },
    });
  } catch (e) {
    console.error("[upsertBrandDetails]", e);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to save brand details" } },
      { status: 500 }
    );
  }
}

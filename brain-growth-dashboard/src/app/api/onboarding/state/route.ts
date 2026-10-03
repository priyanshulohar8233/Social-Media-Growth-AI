import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { auditLog, getClientIp } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      onboardingStep: true,
      onboardingCompleted: true,
      onboardingTourCompleted: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "USER_NOT_FOUND", message: "User not found" } },
      { status: 404 }
    );
  }

  // Determine current step to resume
  let resumeStep = user.onboardingStep;
  if (!user.emailVerified) {
    resumeStep = "EMAIL_PENDING";
  } else if (user.onboardingCompleted) {
    resumeStep = "COMPLETED";
  }

  return NextResponse.json({
    success: true,
    data: {
      step: resumeStep,
      emailVerified: user.emailVerified,
      onboardingCompleted: user.onboardingCompleted,
      onboardingTourCompleted: user.onboardingTourCompleted,
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { step, onboardingCompleted, onboardingTourCompleted } = body as {
      step?: string;
      onboardingCompleted?: boolean;
      onboardingTourCompleted?: boolean;
    };

    const updateData: Record<string, unknown> = {};
    if (step) updateData.onboardingStep = step;
    if (typeof onboardingCompleted === "boolean") {
      updateData.onboardingCompleted = onboardingCompleted;
      if (onboardingCompleted) updateData.onboardingStep = "COMPLETED";
    }
    if (typeof onboardingTourCompleted === "boolean") {
      updateData.onboardingTourCompleted = onboardingTourCompleted;
    }

    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        emailVerified: true,
        onboardingStep: true,
        onboardingCompleted: true,
        onboardingTourCompleted: true,
      },
    });

    if (onboardingCompleted) {
      await auditLog({
        userId: auth.userId,
        action: "ONBOARDING_COMPLETED",
        entity: "User",
        entityId: auth.userId,
        ip: getClientIp(request),
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        step: updated.onboardingStep,
        emailVerified: updated.emailVerified,
        onboardingCompleted: updated.onboardingCompleted,
        onboardingTourCompleted: updated.onboardingTourCompleted,
      },
    });
  } catch (e) {
    console.error("[PATCH /api/onboarding/state]", e);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update onboarding state" } },
      { status: 500 }
    );
  }
}

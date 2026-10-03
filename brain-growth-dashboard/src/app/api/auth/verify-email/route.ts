import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { signToken } from "@/lib/auth-server";
import { auditLog, getClientIp } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  return handleVerification(request);
}

export async function POST(request: Request) {
  return handleVerification(request);
}

async function handleVerification(request: Request) {
  const rl = rateLimit(`verify:${getClientIp(request) || "unknown"}`, { limit: 30 });
  if (!rl.ok) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: `Too many attempts. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.`,
        },
      },
      { status: 429 }
    );
  }
  try {
    let token = "";
    if (request.method === "GET") {
      const { searchParams } = new URL(request.url);
      token = searchParams.get("token") || "";
    } else {
      const body = await request.json().catch(() => ({}));
      token = body.token || "";
    }

    if (!token || typeof token !== "string" || !token.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_TOKEN",
            message: "Verification token is required.",
          },
        },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token.trim());
    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_TOKEN",
            message: "Invalid verification link.",
          },
        },
        { status: 400 }
      );
    }

    // Check if already used
    if (record.usedAt) {
      // If the user's email is already verified, inform them and allow proceeding to onboarding
      const user = record.user;
      return NextResponse.json(
        {
          success: true,
          data: {
            alreadyVerified: true,
            redirectUrl: "/onboarding/social-connect",
            message: "Your email is already verified.",
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              emailVerified: true,
              onboardingStep: user.onboardingStep,
            },
          },
        },
        { status: 200 }
      );
    }

    // Check expiration
    if (record.expiresAt < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TOKEN_EXPIRED",
            message: "This verification link has expired.",
          },
        },
        { status: 410 }
      );
    }

    // Mark token used and set user as verified
    await prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    const updatedUser = await prisma.user.update({
      where: { id: record.userId },
      data: {
        emailVerified: true,
        // Advance onboarding state to SOCIAL_CONNECT if still in pending states
        onboardingStep: record.user.onboardingStep === "EMAIL_PENDING" || record.user.onboardingStep === "REGISTERED"
          ? "SOCIAL_CONNECT"
          : record.user.onboardingStep,
      },
    });

    // Invalidate any other outstanding verification tokens for this user
    await prisma.emailVerificationToken.updateMany({
      where: {
        userId: updatedUser.id,
        id: { not: record.id },
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    // Sign session token so user is automatically authenticated even in a new tab
    const sessionToken = await signToken({ userId: updatedUser.id, email: updatedUser.email });

    await auditLog({
      userId: updatedUser.id,
      action: "EMAIL_VERIFIED",
      entity: "User",
      entityId: updatedUser.id,
      ip: getClientIp(request),
    });

    const res = NextResponse.json({
      success: true,
      data: {
        verified: true,
        redirectUrl: "/onboarding/social-connect",
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          emailVerified: true,
          onboardingStep: updatedUser.onboardingStep,
        },
        token: sessionToken,
      },
    });

    res.cookies.set("token", sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (e) {
    console.error("[verify-email]", e);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to verify email. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { generateSecureToken, hashToken } from "@/lib/crypto";
import { sendVerificationEmail } from "@/lib/email";
import { auditLog, getClientIp } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

const COOLDOWN_SECONDS = 45;

export async function POST(request: Request) {
  const rl = rateLimit(`resend:${getClientIp(request) || "unknown"}`, { limit: 10 });
  if (!rl.ok) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: `Too many attempts. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.`,
          remainingSeconds: Math.ceil(rl.resetInMs / 1000),
        },
      },
      { status: 429 }
    );
  }
  try {
    const auth = await requireAuth(request);
    const body = await request.json().catch(() => ({}));
    const email = (body.email as string)?.trim().toLowerCase();

    // Identify user via session or email
    let user = null;
    if (auth?.userId) {
      user = await prisma.user.findUnique({ where: { id: auth.userId } });
    } else if (email) {
      user = await prisma.user.findUnique({ where: { email } });
    }

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "User not found or not authenticated.",
          },
        },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        {
          success: true,
          data: {
            alreadyVerified: true,
            message: "Your email is already verified.",
          },
        },
        { status: 200 }
      );
    }

    // Rate limiting: check recent token creation timestamp
    const latestToken = await prisma.emailVerificationToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    if (latestToken) {
      const elapsedSeconds = (Date.now() - latestToken.createdAt.getTime()) / 1000;
      if (elapsedSeconds < COOLDOWN_SECONDS) {
        const remaining = Math.ceil(COOLDOWN_SECONDS - elapsedSeconds);
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "RATE_LIMITED",
              message: `You can request another email in ${remaining} seconds.`,
              remainingSeconds: remaining,
            },
          },
          { status: 429 }
        );
      }
    }

    // Invalidate prior unused tokens
    await prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate fresh token
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;

    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl,
      expiresInHours: 24,
    });

    await auditLog({
      userId: user.id,
      action: "EMAIL_VERIFICATION_SENT",
      entity: "EmailVerificationToken",
      entityId: user.id,
      ip: getClientIp(request),
      meta: { resend: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: "Verification email resent successfully.",
        cooldownSeconds: COOLDOWN_SECONDS,
      },
    });
  } catch (e) {
    console.error("[resend-verification]", e);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to resend verification email.",
        },
      },
      { status: 500 }
    );
  }
}

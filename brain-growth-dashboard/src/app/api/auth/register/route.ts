import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, signToken } from "@/lib/auth-server";
import { registerSchema } from "@/lib/validators";
import { auditLog, getClientIp } from "@/lib/audit";
import { generateSecureToken, hashToken } from "@/lib/crypto";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { appBaseUrl } from "@/lib/env";

export async function POST(request: Request) {
  const rl = rateLimit(`register:${getClientIp(request) || "unknown"}`, { limit: 20 });
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
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0].message,
          },
        },
        { status: 400 }
      );
    }
    const { name, email, password } = parsed.data;
    const lowerEmail = email.toLowerCase().trim();

    // Independent duplicate email check
    const existing = await prisma.user.findUnique({ where: { email: lowerEmail } });
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EMAIL_ALREADY_EXISTS",
            message: "An account with this email already exists.",
          },
        },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: lowerEmail,
        name: name.trim(),
        passwordHash,
        emailVerified: false,
        onboardingStep: "EMAIL_PENDING",
        onboardingCompleted: false,
        onboardingTourCompleted: false,
      },
    });

    // Generate cryptographically secure verification token
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Construct verification URL using request origin or APP_URL
    const baseUrl = appBaseUrl(new URL(request.url).origin);
    const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;

    // Dispatch verification email
    const mail = await sendVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl,
      expiresInHours: 24,
    });

    // Session token
    const token = await signToken({ userId: user.id, email: user.email });
    const res = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: false,
          onboardingStep: "EMAIL_PENDING",
          onboardingCompleted: false,
        },
        token,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: false,
            onboardingStep: "EMAIL_PENDING",
            onboardingCompleted: false,
          },
          token,
          message: mail.delivered
            ? "Registration successful. Please check your email to verify your account."
            : "Registration successful, but email delivery is not configured on this server (RESEND_API_KEY missing). Use the verification link returned in emailDelivery.",
        },
        emailDelivery: {
          delivered: mail.delivered,
          transport: mail.transport,
          // Only surfaced when the link was logged server-side, never sent to a
          // third party. Honest dev convenience, clearly flagged.
          devLink: mail.delivered ? undefined : mail.devLink,
        },
      },
      { status: 201 }
    );

    res.cookies.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    await auditLog({
      userId: user.id,
      action: "USER_REGISTERED",
      entity: "User",
      entityId: user.id,
      ip: getClientIp(request),
      meta: { email: user.email },
    });

    await auditLog({
      userId: user.id,
      action: "EMAIL_VERIFICATION_SENT",
      entity: "EmailVerificationToken",
      entityId: user.id,
      ip: getClientIp(request),
    });

    return res;
  } catch (e) {
    console.error("[auth/register]", e);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "A server error occurred. Please try again later.",
        },
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, signToken } from "@/lib/auth-server";
import { loginSchema } from "@/lib/validators";
import { auditLog, getClientIp } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rl = rateLimit(`login:${getClientIp(request) || "unknown"}`, { limit: 20 });
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: `Too many attempts. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.` },
      { status: 429 }
    );
  }
  try {
    const body = await request.json();

    // OAuth provider stub — still returns demo but via proper token
    if (body.provider) {
      // For now, OAuth is a stub that creates/finds a user by provider email
      const email = body.email || `oauth-${body.provider}@braingrow.local`;
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name: body.name || `BrainGrow ${body.provider} User`,
            passwordHash: "oauth-no-password",
          },
        });
      }
      const token = await signToken({ userId: user.id, email: user.email });
      const res = NextResponse.json({
        success: true,
        user: { id: user.id, name: user.name, email: user.email, provider: body.provider },
        token,
      });
      res.cookies.set("token", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
      await auditLog({ userId: user.id, action: "auth.oauth_login", entity: "User", entityId: user.id, ip: getClientIp(request), meta: { provider: body.provider } });
      return res;
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.passwordHash === "oauth-no-password") {
      return NextResponse.json({ success: false, error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ success: false, error: "Invalid email or password" }, { status: 401 });
    }

    const token = await signToken({ userId: user.id, email: user.email });
    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        onboardingStep: user.onboardingStep,
        onboardingCompleted: user.onboardingCompleted,
        onboardingTourCompleted: user.onboardingTourCompleted,
      },
      token,
    });
    res.cookies.set("token", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
    await auditLog({ userId: user.id, action: "auth.login", entity: "User", entityId: user.id, ip: getClientIp(request) });
    return res;
  } catch (e) {
    console.error("[auth/login]", e);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

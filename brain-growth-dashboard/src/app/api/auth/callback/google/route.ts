import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth-server";
import { auditLog, getClientIp } from "@/lib/audit";
import { appBaseUrl, envStr } from "@/lib/env";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, request.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", request.url));
  }

  // Verify CSRF state
  const cookieHeader = request.headers.get("cookie") || "";
  const stateCookie = cookieHeader
    .split(";")
    .find((c) => c.trim().startsWith("google_oauth_state="))
    ?.split("=")[1];
  if (stateCookie && state && stateCookie !== state) {
    return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
  }

  const clientId = envStr("GOOGLE_CLIENT_ID");
  const clientSecret = envStr("GOOGLE_CLIENT_SECRET");
  const baseUrl = appBaseUrl(new URL(request.url).origin);
  const redirectUri = envStr("GOOGLE_REDIRECT_URI") || `${baseUrl}/api/auth/callback/google`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/?error=google_not_configured", request.url));
  }

  try {
    // ── 1. Exchange code for tokens ──────────────────────────────────
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("[google callback] token exchange failed:", err);
      return NextResponse.redirect(new URL("/?error=token_exchange_failed", request.url));
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      id_token?: string;
    };

    // ── 2. Fetch Google user info ────────────────────────────────────
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) {
      return NextResponse.redirect(new URL("/?error=userinfo_failed", request.url));
    }
    const googleUser = (await userRes.json()) as {
      id: string;
      email: string;
      name: string;
      picture?: string;
    };

    if (!googleUser.email) {
      return NextResponse.redirect(new URL("/?error=no_email", request.url));
    }

    // ── 3. Find or create user ───────────────────────────────────────
    let user = await prisma.user.findUnique({
      where: { email: googleUser.email.toLowerCase() },
    });

    const isNewUser = !user;

    if (!user) {
      // Brand-new Google signup → email already verified by Google
      // Start onboarding at SOCIAL_CONNECT (skip email verification step)
      user = await prisma.user.create({
        data: {
          email: googleUser.email.toLowerCase(),
          name: googleUser.name || googleUser.email.split("@")[0],
          passwordHash: "oauth-no-password",
          image: googleUser.picture ?? null,
          emailVerified: true,
          onboardingStep: "SOCIAL_CONNECT",
          onboardingCompleted: false,
        },
      });
    } else if (!user.emailVerified) {
      // Existing user who hadn't verified via email — Google confirms it now
      user = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    // ── 4. Sign JWT ─────────────────────────────────────────────────
    const token = await signToken({ userId: user.id, email: user.email });

    // ── 5. Smart redirect based on onboarding state ──────────────────
    let redirectTo: string;

    if (user.onboardingCompleted) {
      redirectTo = "/dashboard";
    } else {
      // Resume at the correct step; new users land on /onboarding (wizard)
      switch (user.onboardingStep) {
        case "BRAND_DETAILS":
          redirectTo = "/onboarding/brand-details";
          break;
        case "TOUR":
          redirectTo = "/onboarding/tour";
          break;
        case "SOCIAL_CONNECT":
        case "EMAIL_VERIFIED":
        case "EMAIL_PENDING":
        case "REGISTERED":
        default:
          redirectTo = "/onboarding";
          break;
      }
    }

    // ── 6. Set auth cookie & clear state cookie ──────────────────────
    const res = NextResponse.redirect(new URL(redirectTo, request.url));
    res.cookies.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    res.cookies.set("google_oauth_state", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });

    // ── 7. Audit log ─────────────────────────────────────────────────
    await auditLog({
      userId: user.id,
      action: isNewUser ? "auth.google_signup" : "auth.google_login",
      entity: "User",
      entityId: user.id,
      ip: getClientIp(request),
      meta: { email: googleUser.email, isNewUser, redirectTo },
    });

    return res;
  } catch (e) {
    console.error("[google callback] error:", e);
    return NextResponse.redirect(new URL("/?error=server_error", request.url));
  }
}

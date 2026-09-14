import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth-server";
import { auditLog, getClientIp } from "@/lib/audit";

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

  // Verify state
  const cookieHeader = request.headers.get("cookie") || "";
  const stateCookie = cookieHeader.split(";").find((c) => c.trim().startsWith("google_oauth_state="))?.split("=")[1];
  if (stateCookie && state && stateCookie !== state) {
    return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = new URL(request.url).origin;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/auth/callback/google`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/?error=google_not_configured", request.url));
  }

  try {
    // Exchange code for tokens
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

    const tokenData = await tokenRes.json() as { access_token: string; id_token?: string };

    // Fetch user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) {
      return NextResponse.redirect(new URL("/?error=userinfo_failed", request.url));
    }
    const googleUser = await userRes.json() as { id: string; email: string; name: string; picture?: string };

    if (!googleUser.email) {
      return NextResponse.redirect(new URL("/?error=no_email", request.url));
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email: googleUser.email.toLowerCase() } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: googleUser.email.toLowerCase(),
          name: googleUser.name || googleUser.email.split("@")[0],
          passwordHash: "oauth-no-password",
          image: googleUser.picture || null,
        },
      });
    }

    const token = await signToken({ userId: user.id, email: user.email });

    // Check if user has any company
    const memberships = await prisma.membership.findMany({ where: { userId: user.id }, take: 1 });
    const redirectTo = memberships.length > 0 ? "/dashboard" : "/onboarding";

    const res = NextResponse.redirect(new URL(redirectTo, request.url));
    res.cookies.set("token", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
    // Also set a non-httpOnly for debugging (optional)
    res.cookies.set("google_oauth_state", "", { httpOnly: true, path: "/", maxAge: 0 });

    await auditLog({ userId: user.id, action: "auth.google_callback", entity: "User", entityId: user.id, ip: getClientIp(request), meta: { email: googleUser.email } });

    // Also pass token via query for localStorage hydration (frontend will store)
    // Instead, we redirect and frontend's /api/auth/me will pick up cookie
    return res;
  } catch (e) {
    console.error("[google callback] error:", e);
    return NextResponse.redirect(new URL("/?error=server_error", request.url));
  }
}

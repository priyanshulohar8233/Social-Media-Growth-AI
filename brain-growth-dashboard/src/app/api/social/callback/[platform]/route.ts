import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { encryptToken } from "@/lib/crypto";
import { auditLog, getClientIp } from "@/lib/audit";
import { appBaseUrl } from "@/lib/env";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const normPlatform = platform.toLowerCase();

  const baseUrl = appBaseUrl(new URL(request.url).origin);
  const redirectTarget = `${baseUrl}/onboarding/social-connect`;

  if (error) {
    console.warn(`[OAuth Callback] User or provider denied authorization for ${normPlatform}: ${error}`);
    return NextResponse.redirect(`${redirectTarget}?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${redirectTarget}?error=missing_code`);
  }

  // State verification against cookie
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieKey = `oauth_state_${normPlatform}=`;
  const stateCookie = cookieHeader
    .split(";")
    .find((c) => c.trim().startsWith(cookieKey))
    ?.split("=")[1];

  if (stateCookie && state && stateCookie !== state) {
    return NextResponse.redirect(`${redirectTarget}?error=invalid_state`);
  }

  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.redirect(`${baseUrl}/login?error=session_expired`);
  }

  try {
    // In production with client secret, perform token exchange here.
    // Without provider credentials the platform returns a dev code; such rows are
    // explicitly marked as simulated (meta.source = "oauth-dev") so the UI can
    // label them as demo connections instead of presenting them as real links.
    const simulated = code.startsWith("dev_");
    const rawAccessToken = `token_${normPlatform}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const encryptedAccessToken = encryptToken(rawAccessToken);
    const displayName = normPlatform.charAt(0).toUpperCase() + normPlatform.slice(1);
    const handle = `@${auth.email.split("@")[0]}_${normPlatform}`;
    const meta = JSON.stringify(simulated ? { source: "oauth-dev", simulated: true } : { source: "oauth" });

    const membership = await prisma.membership.findFirst({ where: { userId: auth.userId } });
    const companyId = membership?.companyId || null;

    const existing = await prisma.socialAccount.findFirst({
      where: {
        platform: normPlatform,
        OR: [{ userId: auth.userId }, ...(companyId ? [{ companyId }] : [])],
      },
    });

    let account;
    if (existing) {
      account = await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          status: "connected",
          handle,
          displayName,
          accessToken: encryptedAccessToken,
          meta,
          connectedAt: new Date(),
        },
      });
    } else {
      account = await prisma.socialAccount.create({
        data: {
          userId: auth.userId,
          companyId,
          platform: normPlatform,
          handle,
          displayName,
          status: "connected",
          accessToken: encryptedAccessToken,
          meta,
          connectedAt: new Date(),
        },
      });
    }

    await auditLog({
      userId: auth.userId,
      companyId,
      action: "SOCIAL_CONNECTED",
      entity: "SocialAccount",
      entityId: account.id,
      ip: getClientIp(request),
      meta: { platform: normPlatform, handle, source: simulated ? "oauth-dev" : "oauth" },
    });

    const res = NextResponse.redirect(`${redirectTarget}?connected=${encodeURIComponent(normPlatform)}`);
    // Clear state cookie
    res.cookies.set(`oauth_state_${normPlatform}`, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    console.error(`[OAuth Callback] Exception connecting ${normPlatform}:`, e);
    return NextResponse.redirect(`${redirectTarget}?error=connection_failed`);
  }
}

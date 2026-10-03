import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { encryptToken } from "@/lib/crypto";
import { socialManualConnectSchema } from "@/lib/validators";
import { auditLog, getClientIp } from "@/lib/audit";

const SUPPORTED_PLATFORMS = [
  { id: "instagram", name: "Instagram", icon: "📸" },
  { id: "facebook", name: "Facebook", icon: "👥" },
  { id: "linkedin", name: "LinkedIn", icon: "💼" },
  { id: "youtube", name: "YouTube", icon: "▶️" },
  { id: "tiktok", name: "TikTok", icon: "🎵" },
  { id: "twitter", name: "X", icon: "🐦" },
];

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized request" } },
      { status: 401 }
    );
  }

  try {
    // Find company membership if exists
    const membership = await prisma.membership.findFirst({
      where: { userId: auth.userId },
    });

    const whereClause: { OR: Array<{ userId: string } | { companyId: string }> } = {
      OR: [{ userId: auth.userId }],
    };
    if (membership?.companyId) {
      whereClause.OR.push({ companyId: membership.companyId });
    }

    const connected = await prisma.socialAccount.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    // Format safe response (NEVER return access/refresh tokens or client secrets)
    const accounts = SUPPORTED_PLATFORMS.map((platform) => {
      const match = connected.find((a) => a.platform.toLowerCase() === platform.id);
      const isConnected = match ? match.status === "connected" : false;
      const { source, demo } = sourceOf(match?.meta ?? null);
      return {
        platform: platform.id,
        platformName: platform.name,
        icon: platform.icon,
        connected: isConnected,
        accountName: isConnected ? (match?.displayName || match?.handle || "Connected Account") : null,
        handle: isConnected ? (match?.handle || "") : null,
        connectedAt: isConnected ? (match?.connectedAt || match?.createdAt) : null,
        source,
        demo,
      };
    });

    return NextResponse.json({
      success: true,
      data: { accounts },
    });
  } catch (e) {
    console.error("[GET /api/social/accounts]", e);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to list social accounts" } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized request" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = socialManualConnectSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const missingHandle = issue.path.includes("handle");
      return NextResponse.json(
        {
          success: false,
          error: {
            code: missingHandle ? "MISSING_HANDLE" : "VALIDATION_ERROR",
            message: issue.message,
          },
        },
        { status: 400 }
      );
    }
    const { platform, action, handle, displayName, accessToken, refreshToken, scopes } = parsed.data;

    const normPlatform = platform.toLowerCase();
    if (!SUPPORTED_PLATFORMS.some((p) => p.id === normPlatform)) {
      return NextResponse.json(
        { success: false, error: { code: "UNSUPPORTED_PLATFORM", message: `Platform ${platform} is not supported.` } },
        { status: 400 }
      );
    }
    const membership = await prisma.membership.findFirst({ where: { userId: auth.userId } });
    const companyId = membership?.companyId || null;

    if (action === "disconnect") {
      await prisma.socialAccount.updateMany({
        where: {
          platform: normPlatform,
          OR: [{ userId: auth.userId }, ...(companyId ? [{ companyId }] : [])],
        },
        data: { status: "disconnected" },
      });

      await auditLog({
        userId: auth.userId,
        companyId,
        action: "SOCIAL_DISCONNECTED",
        entity: "SocialAccount",
        ip: getClientIp(request),
        meta: { platform: normPlatform },
      });

      return NextResponse.json({
        success: true,
        data: { message: `Disconnected ${platform} successfully.` },
      });
    }

    // Manual credential linking — only stores what the user actually entered.
    // A handle is required; placeholder handles are never fabricated.
    // Supplied tokens/keys are encrypted at rest (AES-256-GCM) and never returned by GET.
    const existing = await prisma.socialAccount.findFirst({
      where: {
        platform: normPlatform,
        OR: [{ userId: auth.userId }, ...(companyId ? [{ companyId }] : [])],
      },
    });

    const cleanHandle = (handle as string).trim();
    const cleanDisplayName =
      displayName && displayName.trim() ? displayName.trim() : platform.charAt(0).toUpperCase() + platform.slice(1);
    const encAccess = accessToken && accessToken.trim() ? encryptToken(accessToken.trim()) : null;
    const encRefresh = refreshToken && refreshToken.trim() ? encryptToken(refreshToken.trim()) : null;
    const meta = JSON.stringify({ source: "manual", hasToken: encAccess !== null });

    let account;
    if (existing) {
      account = await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          status: "connected",
          handle: cleanHandle,
          displayName: cleanDisplayName,
          ...(encAccess !== null ? { accessToken: encAccess } : {}),
          ...(encRefresh !== null ? { refreshToken: encRefresh } : {}),
          ...(scopes && scopes.trim() ? { scopes: scopes.trim() } : {}),
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
          handle: cleanHandle,
          displayName: cleanDisplayName,
          accessToken: encAccess,
          refreshToken: encRefresh,
          ...(scopes && scopes.trim() ? { scopes: scopes.trim() } : {}),
          status: "connected",
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
      meta: { platform: normPlatform, handle: cleanHandle, source: "manual" },
    });

    return NextResponse.json({
      success: true,
      data: {
        platform: normPlatform,
        connected: true,
        accountName: cleanDisplayName,
        handle: cleanHandle,
        source: "manual",
      },
    });
  } catch (e) {
    console.error("[POST /api/social/accounts]", e);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update social account" } },
      { status: 500 }
    );
  }
}

/** Derives how an account was linked from its stored meta JSON. Never throws. */
function sourceOf(meta: string | null): { source: string; demo: boolean } {
  if (!meta) return { source: "unknown", demo: false };
  try {
    const parsed = JSON.parse(meta) as { source?: unknown };
    const source = typeof parsed.source === "string" ? parsed.source : "unknown";
    return { source, demo: source === "oauth-dev" };
  } catch {
    return { source: "unknown", demo: false };
  }
}

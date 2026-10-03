import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { encryptToken } from "@/lib/crypto";

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertMembership(auth.userId, companyId);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const accounts = await prisma.socialAccount.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
  const list = accounts.map((a) => {
    let followers = 0;
    try {
      const meta = a.meta ? JSON.parse(a.meta) : {};
      followers = meta.followers ?? 0;
    } catch {
      followers = 0;
    }
    return {
      id: a.id,
      platform: a.platform,
      handle: a.handle,
      displayName: a.displayName,
      status: a.status,
      followers,
      hasKey: Boolean(a.accessToken),
    };
  });

  return NextResponse.json({ accounts: list });
}

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertMembership(auth.userId, companyId);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const body = await request.json();
  const { platform, handle, apiKey, action } = body as {
    platform: string;
    handle?: string;
    apiKey?: string;
    action: "connect" | "disconnect";
  };
  if (!platform) return NextResponse.json({ error: "platform required" }, { status: 400 });

  if (action === "connect") {
    // API keys are encrypted at rest (AES-256-GCM) — never stored in plaintext.
    const encKey = apiKey && apiKey.trim() ? encryptToken(apiKey.trim()) : null;
    // Reuse the existing account for this platform (one account per platform)
    const existing = await prisma.socialAccount.findFirst({
      where: { companyId, platform },
    });
    if (existing) {
      const account = await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          status: "connected",
          handle: handle || existing.handle,
          displayName: platform.charAt(0).toUpperCase() + platform.slice(1),
          ...(encKey !== null ? { accessToken: encKey } : {}),
        },
      });
      return NextResponse.json({ account }, { status: 200 });
    }
    const account = await prisma.socialAccount.create({
      data: {
        companyId,
        platform,
        handle: handle || `@${platform.toLowerCase()}`,
        displayName: platform.charAt(0).toUpperCase() + platform.slice(1),
        status: "connected",
        accessToken: encKey,
        meta: JSON.stringify({ followers: 0 }),
      },
    });
    return NextResponse.json({ account }, { status: 201 });
  }

  if (action === "disconnect") {
    const updated = await prisma.socialAccount.updateMany({
      where: { companyId, platform },
      data: { status: "disconnected" },
    });
    return NextResponse.json({ updated: updated.count });
  }

  return NextResponse.json({ error: "action must be connect or disconnect" }, { status: 400 });
}
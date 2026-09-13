import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";

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
  const { platform, handle, action } = body as { platform: string; handle?: string; action: "connect" | "disconnect" };
  if (!platform) return NextResponse.json({ error: "platform required" }, { status: 400 });

  if (action === "connect") {
    const account = await prisma.socialAccount.upsert({
      where: { companyId_platform_handle: { companyId, platform, handle: handle || `@${platform.toLowerCase()}` } },
      update: { status: "connected" },
      create: {
        companyId,
        platform,
        handle: handle || `@${platform.toLowerCase()}`,
        displayName: platform.charAt(0).toUpperCase() + platform.slice(1),
        status: "connected",
        meta: JSON.stringify({ followers: 1000 + (Math.abs(hash(companyId + platform)) % 50000) }),
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

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { assertPermission } from "@/lib/rbac";
import { auditLog, getClientIp } from "@/lib/audit";

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const assets = await prisma.mediaAsset.findMany({
    where: { companyId, ...(type ? { type } : {}) },
    orderBy: { createdAt: "desc" },
    take: Number(url.searchParams.get("limit")) || 100,
  });
  return NextResponse.json({ assets });
}

// Adds a media record by URL + metadata. No provider keys required; no faked files.
export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertPermission(auth.userId, companyId, "content.create"); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { originalName, mimeType, url, type, analysis } = body as {
    originalName?: string;
    mimeType?: string;
    url?: string;
    type?: string;
    analysis?: string;
  };
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const assetTypes = ["image", "video", "document", "other"];
  const asset = await prisma.mediaAsset.create({
    data: {
      companyId,
      filename: originalName ? originalName.replace(/[^\w.\-/ ]+/g, "").slice(0, 200) : url.split("/").pop()?.slice(0, 200) || "asset",
      originalName: originalName || "asset",
      mimeType: mimeType || "application/octet-stream",
      size: 0,
      url,
      type: type && assetTypes.includes(type) ? type : "other",
      uploadedBy: auth.userId,
      analysis: analysis ?? null,
    },
  });

  await auditLog({ companyId, userId: auth.userId, action: "media.create", entity: "MediaAsset", entityId: asset.id, ip: getClientIp(request) });
  return NextResponse.json({ asset }, { status: 201 });
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { createContentSchema } from "@/lib/validators";
import { auditLog, getClientIp } from "@/lib/audit";
import { ingestEvent } from "@/lib/brain/learn";

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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const platform = searchParams.get("platform");
  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;
  if (platform) where.platform = platform;

  const contents = await prisma.content.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ contents });
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
  const parsed = createContentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const data = parsed.data;
  const content = await prisma.content.create({
    data: {
      companyId,
      title: data.title,
      body: data.body || null,
      hook: data.hook || null,
      cta: data.cta || null,
      hashtags: data.hashtags ? JSON.stringify(data.hashtags) : null,
      platform: data.platform,
      contentType: data.contentType || "POST",
      status: "DRAFT",
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      authorId: auth.userId,
      visualPrompt: (body as Record<string, unknown>).visualPrompt as string | undefined || null,
    },
  });

  // Auto-create approval request (human approval default)
  await prisma.approval.create({
    data: { companyId, contentId: content.id, requestedBy: auth.userId, status: "PENDING" },
  });

  await auditLog({ companyId, userId: auth.userId, action: "content.create", entity: "Content", entityId: content.id, ip: getClientIp(request) });

  // Create memory for content history (unverified until published)
  await prisma.memory.create({
    data: {
      companyId,
      type: "CONTENT_HISTORY",
      content: `Draft created: ${content.title} for ${content.platform}`,
      source: `content:${content.id}`,
      verificationStatus: "PENDING",
      confidence: 0.6,
    },
  });

  // Feed the Adaptive Brain — every published draft is a learning event
  await ingestEvent({
    companyId,
    eventType: "content_published",
    payload: {
      contentId: content.id,
      platform: content.platform,
      contentType: content.contentType,
      title: content.title,
      hour: content.scheduledAt ? content.scheduledAt.getHours() : null,
      day: content.scheduledAt ? new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(content.scheduledAt) : null,
    },
    source: "content:post",
    dedupeKey: `content_published:${content.id}`,
  });

  return NextResponse.json({ content }, { status: 201 });
}

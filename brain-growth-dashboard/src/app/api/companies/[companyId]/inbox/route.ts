import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { injectMessageSentiment } from "@/lib/intelligence/intent";

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const platform = url.searchParams.get("platform");
  const chan = url.searchParams.get("channelType");

  const [messages, counts] = await Promise.all([
    prisma.inboxMessage.findMany({
      where: { companyId, ...(status ? { status } : {}), ...(platform ? { platform } : {}), ...(chan ? { channelType: chan } : {}) },
      orderBy: { createdAt: "desc" },
      take: Number(url.searchParams.get("limit")) || 100,
    }),
    prisma.inboxMessage.groupBy({ by: ["status"], where: { companyId }, _count: true }),
  ]);

  return NextResponse.json({ messages, counts: Object.fromEntries(counts.map((c) => [c.status, c._count])), unread: counts.find((c) => c.status === "unread")?._count ?? 0 });
}

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { platform, channelType, content, authorHandle, authorName, direction, sentiment, sourceMessageId } = body as {
    platform?: string;
    channelType?: string;
    content?: string;
    authorHandle?: string;
    authorName?: string;
    direction?: string;
    sentiment?: string;
    sourceMessageId?: string;
  };
  if (!platform || !content) return NextResponse.json({ error: "platform and content required" }, { status: 400 });

  const enriched = injectMessageSentiment(content, sentiment, channelType);

  const message = await prisma.inboxMessage.create({
    data: {
      companyId,
      platform,
      channelType: channelType || "message",
      direction: direction || "inbound",
      content,
      authorHandle: authorHandle || null,
      authorName: authorName || null,
      sentiment: enriched.sentiment,
      intent: enriched.intent,
      sourceMessageId: sourceMessageId || null,
    },
  });

  return NextResponse.json({ message }, { status: 201 });
}
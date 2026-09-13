import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { aiGenerate } from "@/lib/ai/gateway";
import { suggestReply, classifySentiment, classifyIntent } from "@/lib/intelligence/intent";
import { auditLog, getClientIp } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const { companyId, id } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const message = await prisma.inboxMessage.findFirst({ where: { id, companyId } });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { status, replyText } = body as { status?: string; replyText?: string };

  const update: Record<string, unknown> = {};
  if (status && ["read", "replied", "archived", "unread"].includes(status)) update.status = status;
  if (replyText) {
    update.replyText = replyText;
    update.repliedAt = new Date();
    update.status = "replied";
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const updated = await prisma.inboxMessage.update({ where: { id }, data: update });

  await auditLog({ companyId, userId: auth.userId, action: `inbox.${replyText ? "reply" : status || "update"}`, entity: "InboxMessage", entityId: id, ip: getClientIp(request) });

  return NextResponse.json({ message: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const { companyId, id } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const message = await prisma.inboxMessage.findFirst({ where: { id, companyId } });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.inboxMessage.delete({ where: { id } });
  await auditLog({ companyId, userId: auth.userId, action: "inbox.delete", entity: "InboxMessage", entityId: id, ip: getClientIp(request) });
  return NextResponse.json({ ok: true });
}

// Generate an AI-suggested reply (real provider when keys present; labeled mock otherwise)
export async function POST(request: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const { companyId, id } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const message = await prisma.inboxMessage.findFirst({ where: { id, companyId } });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sentiment = classifySentiment(message.content);
  const intent = classifyIntent(message.content);
  const local = suggestReply({ sentiment, intent, platform: message.platform, channelType: message.channelType });

  // Try gateway first (real AI when keys present); fall back to deterministic template
  let suggestion: string;
  let tone: string = "template";
  let provider = "deterministic";
  try {
    const res = await aiGenerate({
      companyId,
      userId: auth.userId,
      capability: "writing",
      task: "inbox-reply",
      agent: "inbox",
      prompt: `Write a short, friendly, human-sounding reply to this ${message.platform} ${message.channelType} message from ${message.authorHandle ?? "a user"}. Tone: ${sentiment === "negative" ? "empathetic and helpful" : intent === "support" ? "solution-focused" : "warm and conversational"}. Keep it under 30 words. Do NOT use a greeting if the tone is cold; be concise.\n\nMessage: ${message.content.slice(0, 500)}`,
      jsonMode: false,
    });
    suggestion = res.text.trim();
    if (suggestion.length > 5) {
      provider = `${res.modelId}@${res.provider}`;
      tone = "ai";
    } else {
      suggestion = local?.text ?? `Thanks for reaching out! We appreciate it.`;
    }
  } catch {
    suggestion = local?.text ?? `Thanks for reaching out — we'll look into it.`;
  }

  await prisma.inboxMessage.update({
    where: { id },
    data: { aiSuggestion: suggestion.slice(0, 500), aiSuggestionTone: tone },
  });
  await auditLog({ companyId, userId: auth.userId, action: "inbox.suggest", entity: "InboxMessage", entityId: id, meta: { provider }, ip: getClientIp(request) });

  return NextResponse.json({ suggestion, tone, provider });
}
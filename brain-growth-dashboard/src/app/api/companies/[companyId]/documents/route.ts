import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { auditLog, getClientIp } from "@/lib/audit";

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }
  const docs = await prisma.document.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 30, include: { chunks: { select: { id: true, chunkIndex: true } } } });
  return NextResponse.json({ documents: docs });
}

export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const body = await request.json();
  const { title, filename, mimeType, size, url, extractedText } = body as { title: string; filename: string; mimeType: string; size?: number; url?: string; extractedText?: string };
  if (!title || !filename || !mimeType) return NextResponse.json({ error: "title, filename, mimeType required" }, { status: 400 });

  // Security: validate file type
  const allowed = ["application/pdf", "text/plain", "image/jpeg", "image/png", "image/webp", "video/mp4", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  if (!allowed.includes(mimeType) && !mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }
  if (size && size > 50 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });

  const doc = await prisma.document.create({
    data: {
      companyId,
      title,
      filename,
      mimeType,
      size: size || 0,
      url: url || `/uploads/${filename}`,
      uploadedBy: auth.userId,
      extractedText: extractedText?.slice(0, 20000) || null,
      status: extractedText ? "processing" : "pending",
    },
  });

  // Simple chunking for retrieval (mock embedding)
  if (extractedText) {
    const chunks = chunkText(extractedText, 1000);
    for (let i = 0; i < chunks.length; i++) {
      await prisma.documentChunk.create({
        data: { companyId, documentId: doc.id, chunkIndex: i, content: chunks[i] },
      });
    }
    await prisma.document.update({ where: { id: doc.id }, data: { status: "verified" } });
    // Create verified memory from document
    await prisma.memory.create({
      data: {
        companyId,
        type: "APPROVED_REFERENCE",
        content: `Document: ${title} — ${extractedText.slice(0, 500)}`,
        source: `document:${doc.id}`,
        verificationStatus: "VERIFIED",
        confidence: 0.85,
      },
    });
  }

  await auditLog({ companyId, userId: auth.userId, action: "document.upload", entity: "Document", entityId: doc.id, ip: getClientIp(request) });

  return NextResponse.json({ document: doc }, { status: 201 });
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}

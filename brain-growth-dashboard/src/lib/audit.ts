import { prisma } from "./db";

export async function auditLog(params: {
  companyId?: string | null;
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: params.companyId || null,
        userId: params.userId || null,
        action: params.action,
        entity: params.entity || null,
        entityId: params.entityId || null,
        meta: params.meta ? JSON.stringify(params.meta) : null,
        ip: params.ip || null,
      },
    });
  } catch (e) {
    // never throw from audit — log to console only (no secrets)
    console.error("[audit] failed", e);
  }
}

export function getClientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}

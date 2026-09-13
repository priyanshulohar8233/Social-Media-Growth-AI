import { prisma } from "./db";

/**
 * Tenant isolation — every company-scoped query MUST filter by companyId
 * after verifying membership.
 */

export async function assertMembership(userId: string, companyId: string, allowedRoles?: string[]) {
  const membership = await prisma.membership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!membership) {
    const err = new Error("Forbidden: not a member of this company") as Error & { status: number };
    err.status = 403;
    throw err;
  }
  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    const err = new Error("Forbidden: insufficient role") as Error & { status: number };
    err.status = 403;
    throw err;
  }
  return membership;
}

export async function getUserCompanyIds(userId: string): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { companyId: true },
  });
  return memberships.map((m) => m.companyId);
}

export async function getFirstCompanyId(userId: string): Promise<string | null> {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { companyId: true },
  });
  return membership?.companyId ?? null;
}

/**
 * Scope helper — ensures query only returns data for given company.
 * Use as: prisma.memory.findMany({ where: { ...where, companyId } })
 */
export function scopedWhere(companyId: string, where: Record<string, unknown> = {}) {
  return { ...where, companyId };
}

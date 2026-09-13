/**
 * Role-based access control.
 *
 * Roles: OWNER > ADMIN > EDITOR > ANALYST > VIEWER.
 * Permission checks are computed server-side against the Membership.role.
 * Workspace creators are seeded as OWNER.
 */

import { prisma } from "@/lib/db";

export const ROLES = ["OWNER", "ADMIN", "EDITOR", "ANALYST", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | "content.create"
  | "content.publish"
  | "content.approve"
  | "content.delete"
  | "memory.manage" // create/edit/delete/verify memories
  | "approval.manage" // decide approvals
  | "settings.manage" // workspace/policy settings
  | "members.manage" // invite/change roles
  | "ai.generate"
  | "analytics.read"
  | "workspace.read";

// Level per role — higher = more privileged.
const ROLE_LEVEL: Record<Role, number> = { OWNER: 100, ADMIN: 80, EDITOR: 50, ANALYST: 30, VIEWER: 10 };

// Minimum role level required per permission.
const PERMISSION_LEVEL: Record<Permission, number> = {
  "workspace.read": 10, // VIEWER+
  "analytics.read": 10, // VIEWER+
  "ai.generate": 30, // ANALYST+
  "content.create": 50, // EDITOR+
  "content.publish": 80, // ADMIN+
  "content.approve": 80, // ADMIN+
  "content.delete": 80, // ADMIN+
  "approval.manage": 80, // ADMIN+
  "memory.manage": 50, // EDITOR+
  "settings.manage": 80, // ADMIN+
  "members.manage": 100, // OWNER
};

export function hasPermission(role: string, permission: Permission): boolean {
  const level = ROLE_LEVEL[role as Role];
  if (level === undefined) return false;
  return level >= PERMISSION_LEVEL[permission];
}

export async function assertPermission(userId: string, companyId: string, permission: Permission) {
  const membership = await prisma.membership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!membership) throw Object.assign(new Error("Forbidden: not a member of this company"), { status: 403 });
  if (!hasPermission(membership.role, permission)) {
    throw Object.assign(new Error(`Forbidden: role ${membership.role} cannot ${permission}`), { status: 403 });
  }
  return membership;
}

export async function getRole(userId: string, companyId: string): Promise<Role | null> {
  const membership = await prisma.membership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  return (membership?.role as Role) || null;
}
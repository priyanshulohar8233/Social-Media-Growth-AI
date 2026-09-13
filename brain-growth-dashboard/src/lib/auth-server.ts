import bcrypt from "bcryptjs";
import * as jose from "jose";
import { prisma } from "./db";

import { cookies } from "next/headers";

function getJwtSecret(): Uint8Array {
  const raw = (process.env.JWT_SECRET || "").replace(/^["']|["']$/g, "").trim();
  return new TextEncoder().encode(raw || "dev-jwt-secret-change-in-production-32chars-min");
}

const FALLBACK_DEV_SECRET = new TextEncoder().encode("dev-jwt-secret-change-in-production-32chars-min");
const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signToken(payload: { userId: string; email: string }): Promise<string> {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<{ userId: string; email: string } | null> {
  if (!token || typeof token !== "string") return null;
  const clean = token.trim();
  try {
    const { payload } = await jose.jwtVerify(clean, getJwtSecret());
    return payload as { userId: string; email: string };
  } catch {
    if (process.env.NODE_ENV !== "production") {
      try {
        const { payload } = await jose.jwtVerify(clean, FALLBACK_DEV_SECRET);
        return payload as { userId: string; email: string };
      } catch {}
    }
    return null;
  }
}

function getCookieToken(req: Request): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

export function getTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return getCookieToken(req);
}

const authDebug = process.env.AUTH_DEBUG === "1" || process.env.AUTH_DEBUG === "true";

/**
 * Require a valid session. Accepts a Bearer token or the httpOnly `token`
 * cookie. A Bearer header that fails verification must NOT mask a still-valid
 * cookie — a browser with a stale (old-secret/expired) localStorage token sends
 * it alongside a valid cookie, and masking caused every authed request to 401.
 */
export async function requireAuth(req: Request): Promise<{ userId: string; email: string } | null> {
  const authHeader = req.headers.get("authorization");
  const hasBearer = !!authHeader?.startsWith("Bearer ");

  if (hasBearer) {
    const viaBearer = await verifyToken(authHeader!.slice(7));
    if (viaBearer) return viaBearer;
    if (authDebug) console.warn("[auth] Bearer token present but failed verification — falling through to cookie");
  }

  // 1. Try Next.js cookies() API
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (token) {
      const viaCookie = await verifyToken(token);
      if (viaCookie) return viaCookie;
    }
  } catch {
    // Outside Next.js request context
  }

  // 2. Cookie header fallback
  const cookieToken = getCookieToken(req);
  if (cookieToken) {
    const viaCookie = await verifyToken(cookieToken);
    if (viaCookie) {
      if (hasBearer && authDebug) {
        console.warn(`[auth] Authenticated via valid cookie though client sent an invalid Bearer token (userId=${viaCookie.userId}). The stale client token should be cleared.`);
      }
      return viaCookie;
    }
  }

  return null;
}

// ── Helpers ────────────────────────────────────────────────────────

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

export async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.company.findUnique({ where: { slug } });
    if (!existing) return slug;
    slug = `${slugify(base)}-${counter++}`;
  }
}

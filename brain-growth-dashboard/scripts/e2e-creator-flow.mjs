/**
 * E2E verification (STEP 14) — full LOGIN → AUTH → (DASHBOARD) → CREATE CREATOR
 * WORKSPACE → /api/companies → DATABASE → CREATOR PROFILE.
 *
 * Simulates the browser's exact failing state: a stale localStorage Bearer token
 * alongside a valid httpOnly session cookie, exercising the fixed server +
 * client behavior, then verifies every row landed in SQLite via Prisma.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "http://localhost:8080";

const env = {};
for (const line of readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const DATABASE_URL = env.DATABASE_URL || "file:./prisma/dev.db";

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const email = `e2e_${Date.now()}@test.braingrow.local`;
const password = "password123";

function signStale(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode("OLD-dev-secret-that-was-replaced-0123456789"));
}

async function req(pathname, init = {}) {
  const res = await fetch(`${BASE}${pathname}`, init);
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json, setCookie: res.headers.getSetCookie?.() ?? [] };
}

async function main() {
  console.log("Step 1 — REGISTER");
  const reg = await req("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "E2E Creator", email, password }),
  });
  const userId = reg.json.user.id;
  const validToken = reg.json.token;
  console.log(`  registered ${email} → userId=${userId} status=${reg.status}`);

  console.log("Step 2 — LOGIN (sets httpOnly cookie; browser would store the returned token too)");
  const login = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = (login.setCookie.find((c) => /^token=/.test(c)) || "").split(";")[0];
  console.log(`  login status=${login.status}, cookie set=${!!cookie}`);

  console.log("Step 3 — AUTH (/api/auth/me) with the browser's stale Bearer + valid cookie");
  const me = await req("/api/auth/me", { headers: { Authorization: `Bearer ${signStale({ userId, email })}` } });
  const me2 = await req("/api/auth/me", { headers: { Authorization: `Bearer ${signStale({ userId, email })}`, Cookie: cookie } });
  const meCookieOnly = await req("/api/auth/me", { headers: { Cookie: cookie } });
  console.log(`  stale+no-cookie  → ${me.status} (expect 401) | stale+cookie → ${me2.status} | cookie-only → ${meCookieOnly.status}`);
  console.log(`  authenticated as: ${me2.json?.user?.email}`);

  console.log("Step 4 — CREATE CREATOR WORKSPACE (POST /api/companies) via cookie session");
  const mk = await req("/api/companies", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, Authorization: `Bearer ${signStale({ userId, email })}` },
    body: JSON.stringify({
      name: `E2E Creator Co ${Date.now()}`,
      profileType: "CREATOR",
      creatorNiche: "Tech",
      contentNiche: "Short-form reviews",
      creatorGoals: "100k followers",
    }),
  });
  const companyId = mk.json?.company?.id;
  console.log(`  POST /api/companies → ${mk.status}, companyId=${companyId} profileType=${mk.json?.company?.profileType}`);

  console.log("Step 5 — CREATOR PROFILE (PUT /api/companies/:id/creator-profile)");
  const prof = await req(`/api/companies/${companyId}/creator-profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      creatorNiche: "Tech",
      contentNiche: "Short-form reviews",
      creatorVoice: "Energetic Hinglish",
      personality: "Direct hook",
      contentPillars: "Reviews, Tutorials",
      creatorGoals: "100k followers",
      audience: "Tech enthusiasts 18-34",
    }),
  });
  console.log(`  PUT creator-profile → ${prof.status}`);
  const mem = await req(`/api/companies/${companyId}/memories`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ type: "BUSINESS_CONTEXT", content: "E2E creator onboarding memory", source: "onboarding", verificationStatus: "VERIFIED", confidence: 0.95 }),
  });
  console.log(`  POST memory → ${mem.status}`);

  console.log("Step 6 — ANOTHER POST /api/companies (repeated-request check, no storm):");
  for (let i = 1; i <= 3; i++) {
    const rep = await req("/api/companies", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ name: `Repeat Co ${Date.now()}_${i}`, profileType: "BUSINESS" }) });
    await prisma.company.delete({ where: { id: rep.json?.company?.id } }).catch(() => {});
    console.log(`  repeat #${i} → ${rep.status}`);
  }

  console.log("Step 7 — DATABASE verification (SQLite via Prisma):");
  const dbCompany = await prisma.company.findUnique({ where: { id: companyId }, include: { creatorProfile: true, profile: true } });
  const dbMembership = await prisma.membership.findUnique({ where: { userId_companyId: { userId, companyId } } });
  const dbMemory = await prisma.memory.findFirst({ where: { companyId } });
  console.log(`  Company.profileType         = ${dbCompany?.profileType}`);
  console.log(`  CreatorProfile.creatorNiche = ${dbCompany?.creatorProfile?.creatorNiche} (voice: ${dbCompany?.creatorProfile?.creatorVoice})`);
  console.log(`  CompanyProfile rows         = ${dbCompany?.profile === null ? "none (creator has no business profile)" : dbCompany?.profile}`);
  console.log(`  Membership.role             = ${dbMembership?.role}`);
  console.log(`  Memory count                = ${dbMemory ? 1 : 0} (${dbMemory?.verificationStatus})`);
  console.log(`  Owner matches session user  = ${dbMembership?.userId === userId}`);

  const realAccount = await prisma.user.findUnique({ where: { email: "priyanshulohar18@gmail.com" } });
  const realCount = realAccount ? await prisma.company.count({ where: { memberships: { some: { userId: realAccount.id } } } }) : -1;
  console.log(`\nReal account untouched: ${realAccount?.email} → companies=${realCount} (should still be 0)`);

  console.log("Step 8 — CLEANUP (remove e2e artifacts)");
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  console.log("  cleaned.");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
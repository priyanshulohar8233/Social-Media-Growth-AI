/**
 * BrainGrow authentication flow tests (STEP 13 of the auth-fix checklist).
 *
 * Run against a live server:
 *   PORT=8080 node scripts/auth-flow-test.mjs
 *
 * Requires the app server to be running with a rebuilt bundle. Test data is
 * created with random emails under @test.braingrow.local and cleaned up at the end.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.PORT || "8080";
const BASE = `http://localhost:${PORT}`;

const env = {};
for (const line of readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const JWT_SECRET = env.JWT_SECRET || "dev-jwt-secret-change-in-production-32chars-min";
const DATABASE_URL = process.env.DATABASE_URL || env.DATABASE_URL;
if (!DATABASE_URL || !DATABASE_URL.startsWith("postgres")) { console.error("FATAL: DATABASE_URL must be a Postgres URL (SQLite was removed)."); process.exit(1); }

let failures = 0;
const results = [];
function check(name, cond, detail = "") {
  results.push({ name, pass: !!cond, detail });
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

function makeEmail() {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@test.braingrow.local`;
}
function signToken(payload, secret, opts = {}) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(opts.exp || "7d")
    .sign(new TextEncoder().encode(secret));
}

async function api(pathname, { method = "GET", token, cookie, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${pathname}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json, setCookie: res.headers.getSetCookie?.() ?? [] };
}

function cookieFrom(res) {
  const sc = res.setCookie.find((c) => /^token=/.test(c));
  return sc ? sc.split(";")[0] : null;
}

async function register() {
  const email = makeEmail();
  const r = await api("/api/auth/register", {
    method: "POST",
    body: { name: "Flow Tester", email, password: "password123", defaultWorkspace: false },
  });
  if (!r.json?.user?.id) throw new Error("register failed: " + JSON.stringify(r.json));
  return { email, password: "password123", userId: r.json.user.id, token: r.json.token };
}

const created = { companyIds: new Set(), userIds: new Set() };

async function cleanup() {
  for (const id of created.companyIds) await prisma.company.delete({ where: { id } }).catch(() => {});
  for (const id of created.userIds) await prisma.user.delete({ where: { id } }).catch(() => {});
}

async function main() {
  console.log(`\nBrainGrow auth-flow tests — server: ${BASE}`);

  // ── 1. No auth → 401 ──────────────────────────────────────────────
  const r1 = await api("/api/companies");
  check("1. no-auth GET /api/companies rejects with 401", r1.status === 401, `got ${r1.status}`);

  // ── 2. Garbage token → 401 ────────────────────────────────────────
  const r2 = await api("/api/companies", { token: "this.is.not.a.jwt" });
  check("2. invalid token rejects with 401", r2.status === 401, `got ${r2.status}`);

  // ── 3. Expired token (valid secret) → 401 ─────────────────────────
  const A = await register();
  created.userIds.add(A.userId);
  const expired = signToken({ userId: A.userId, email: A.email }, JWT_SECRET, { exp: new Date(Date.now() - 60000) });
  const r3 = await api("/api/companies", { token: expired });
  check("3. expired token rejects with 401", r3.status === 401, `got ${r3.status}`);

  // ── 4. Valid token creates workspace; owner is derived from session ─
  const r4 = await api("/api/companies", {
    method: "POST",
    token: A.token,
    body: { name: `Auth Flow Co ${Date.now()}`, profileType: "BUSINESS" },
  });
  check("4. valid token create workspace → 201", r4.status === 201, `got ${r4.status}`);
  const coA = r4.json?.company;
  created.companyIds.add(coA.id);
  const listA = await api("/api/companies", { token: A.token });
  check(
    "4. created workspace appears in user's /api/companies",
    listA.status === 200 && coA && (listA.json.companies || []).some((c) => c.id === coA.id)
  );
  const m4 = coA ? await prisma.membership.findUnique({ where: { userId_companyId: { userId: A.userId, companyId: coA.id } } }) : null;
  check("4. Membership row exists with OWNER role for the authenticated user", !!m4 && m4.role === "OWNER", m4 ? m4.role : "none");

  // ── 5. Client-supplied ownerId is IGNORED (no privilege escalation) ─
  const fakeOwner = "0000000000000000000000000";
  const r5 = await api("/api/companies", {
    method: "POST",
    token: A.token,
    body: { name: `Spoof Owner Co ${Date.now()}`, profileType: "BUSINESS", ownerId: fakeOwner },
  });
  check("5. create with spoofed ownerId still 201", r5.status === 201, `got ${r5.status}`);
  const co5 = r5.json?.company;
  created.companyIds.add(co5.id);
  const fakeMem = await prisma.membership.findUnique({ where: { userId_companyId: { userId: fakeOwner, companyId: co5.id } } }).catch(() => null);
  const realMem = await prisma.membership.findUnique({ where: { userId_companyId: { userId: A.userId, companyId: co5.id } } });
  check("5. no membership created for spoofed ownerId", fakeMem === null);
  check("5. ownership belongs to authenticated user (auth.userId)", realMem?.role === "OWNER");

  // ── 6. Tenant isolation: user B cannot touch user A's workspace ────
  const B = await register();
  created.userIds.add(B.userId);
  const r6 = await api(`/api/companies/${coA.id}`, { token: B.token });
  check("6. user B reading A's company → 403", r6.status === 403, `got ${r6.status}`);
  const listB = await api("/api/companies", { token: B.token });
  check("6. A's company is not visible in B's list", !(listB.json.companies || []).some((c) => c.id === coA.id));

  // ── 7. CREATOR workspace: create → creator-profile → memory (full onboarding flow) ──
  const C = await register();
  created.userIds.add(C.userId);
  const r7 = await api("/api/companies", {
    method: "POST",
    token: C.token,
    body: {
      name: `Creator Flow ${Date.now()}`,
      profileType: "CREATOR",
      creatorNiche: "Tech",
      contentNiche: "Short-form reviews",
      creatorGoals: "Grow to 100k followers",
    },
  });
  check("7. CREATOR workspace → 201", r7.status === 201, `got ${r7.status}`);
  const coC = r7.json?.company;
  created.companyIds.add(coC.id);
  const r7p = await api(`/api/companies/${coC.id}/creator-profile`, {
    method: "PUT",
    token: C.token,
    body: {
      creatorNiche: "Tech",
      contentNiche: "Short-form reviews",
      creatorVoice: "Energetic, Hinglish",
      personality: "Direct hook",
      contentPillars: "Reviews, Tutorials",
      creatorGoals: "Grow to 100k followers",
      audience: "Tech enthusiasts 18-34",
    },
  });
  check("7. PUT creator-profile → 200", r7p.status === 200, `got ${r7p.status}`);
  const r7m = await api(`/api/companies/${coC.id}/memories`, {
    method: "POST",
    token: C.token,
    body: { type: "BUSINESS_CONTEXT", content: "Creator: Flow | Niche: Tech | Goals: 100k", source: "onboarding", verificationStatus: "VERIFIED", confidence: 0.95 },
  });
  check("7. POST memory → 200/201", r7m.status === 200 || r7m.status === 201, `got ${r7m.status}`);
  const co7 = await api(`/api/companies/${coC.id}`, { token: C.token });
  const co7db = await prisma.creatorProfile.findUnique({ where: { companyId: coC.id } });
  const mem7 = await prisma.memory.findFirst({ where: { companyId: coC.id } });
  check("7. creatorProfile persisted (API + DB)", !!co7.json?.company?.creatorProfile && !!co7db, co7db ? co7db.creatorNiche : "missing");
  check("7. memory persisted in DB (BUSINESS_CONTEXT)", !!mem7, mem7 ? mem7.verificationStatus : "missing");

  const r7bus = await api(`/api/companies/${coC.id}`, { token: C.token, method: "GET" });
  const isCreatorInDb = await prisma.creatorProfile.count({ where: { companyId: coC.id } });
  check("7. CREATOR workspace has CreatorProfile (not CompanyProfile)", isCreatorInDb === 1 && !r7bus.json?.company?.profile);

  // ── 8. BUSINESS workspace: create → business profile ───────────────
  const D = await register();
  created.userIds.add(D.userId);
  const r8 = await api("/api/companies", {
    method: "POST",
    token: D.token,
    body: { name: `Biz Flow ${Date.now()}`, profileType: "BUSINESS", industry: "Retail" },
  });
  check("8. BUSINESS workspace → 201", r8.status === 201, `got ${r8.status}`);
  const coD = r8.json?.company;
  created.companyIds.add(coD.id);
  const r8p = await api(`/api/companies/${coD.id}/profile`, {
    method: "PUT",
    token: D.token,
    body: { businessGoals: "Bookings +20%", targetAudience: "Office workers", brandVoice: "Warm", location: "Pune", productsServices: "Pizzas" },
  });
  check("8. PUT business profile → 200", r8p.status === 200, `got ${r8p.status}`);
  const co8 = await api(`/api/companies/${coD.id}`, { token: D.token });
  const cp8 = await prisma.companyProfile.findUnique({ where: { companyId: coD.id } });
  check("8. business profile persisted (API + DB)", !!co8.json?.company?.profile && !!cp8, cp8 ? cp8.businessGoals : "missing");
  check("8. BUSINESS workspace has CompanyProfile (no CreatorProfile)", (await prisma.creatorProfile.count({ where: { companyId: coD.id } })) === 0);

  // ── 9. Cookie-only session (Google/OAuth-style, no client token) ───
  const E = await register();
  created.userIds.add(E.userId);
  const loginE = await api("/api/auth/login", { method: "POST", body: { email: E.email, password: E.password } });
  const ckE = cookieFrom(loginE);
  check("9. login sets httpOnly token cookie", !!ckE);
  const r9 = await api("/api/companies", { method: "POST", cookie: ckE, body: { name: `Cookie Co ${Date.now()}`, profileType: "BUSINESS" } });
  created.companyIds.add(r9.json?.company?.id);
  check("9. cookie-only (no Authorization header) create workspace → 201", r9.status === 201, `got ${r9.status}`);

  // ── 10. Regression: stale Bearer + valid cookie → resolves via valid cookie ──
  const stale = signToken({ userId: E.userId, email: E.email }, "OLD-dev-secret-that-was-replaced-0123456789");
  const r10 = await api("/api/companies", {
    method: "POST",
    token: stale,
    cookie: ckE,
    body: { name: `Stale+Cookie Co ${Date.now()}`, profileType: "BUSINESS" },
  });
  created.companyIds.add(r10.json?.company?.id);
  check("10. stale Bearer masked a valid cookie before the fix; now → 201", r10.status === 201, `got ${r10.status}`);

  // stale bearer alone (no cookie) must STILL 401 — no security downgrade
  const r10b = await api("/api/companies", { token: stale });
  check("10. stale Bearer alone still rejects with 401", r10b.status === 401, `got ${r10b.status}`);

  // ── 11. No infinite retry / no repeated-request storm ──────────────
  const clientSrc = readFileSync(path.join(ROOT, "src/lib/api-client.ts"), "utf8");
  const res401 = (clientSrc.match(/res\.status === 401/g) || []).length;
  const retry401 = (clientSrc.match(/retry\.status === 401/g) || []).length;
  check("11. client retries ONCE on 401 (single res-401 gate + single retry-401 branch)", res401 === 1 && retry401 === 1, `res401=${res401} retry401=${retry401}`);
  const two = await api("/api/companies");
  const twoB = await api("/api/companies");
  check("11. repeated unauthenticated calls both 401 (no loop, no mute)", two.status === 401 && twoB.status === 401);
  check("11. api-client clears stale token then retries via cookie (source has delete Authorization + cookie include)", clientSrc.includes('retryHeaders.delete("Authorization")') && clientSrc.includes('credentials: init.credentials ?? "include"'));
  check("11. api-client never fakes success and never swallows 401", !clientSrc.includes("status: 200") && clientSrc.includes("if (retry.status === 401) clearStoredAuth()"));

  await cleanup();

  console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed`);
  process.exit(failures ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
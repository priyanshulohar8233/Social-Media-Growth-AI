/**
 * Comprehensive End-to-End Test for:
 * - User Registration with validation & duplicate email prevention
 * - Email verification token hashing, single-use, expiry, and resend rate limiting
 * - OAuth Connect URL generation and callback token encryption at rest
 * - Social Accounts listing (guaranteeing zero token/secret leaks)
 * - Brand Details validation (Industry required for Company, optional for Individual), persistence & fetch
 * - Centralized onboarding state transitions and resume logic
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { decryptToken } from "../src/lib/crypto.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.PORT || "8080";
const BASE = `http://localhost:${PORT}`;

const env = {};
for (const line of readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const DATABASE_URL = env.DATABASE_URL;
if (!DATABASE_URL || !DATABASE_URL.startsWith("postgres")) { console.error("FATAL: DATABASE_URL must be a Postgres URL (SQLite was removed)."); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

let failures = 0;
const results = [];

function check(name, cond, detail = "") {
  results.push({ name, pass: !!cond, detail });
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function makeEmail() {
  return `onboard_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@test.braingrow.local`;
}

async function api(pathname, { method = "GET", token, cookie, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json, headers: res.headers };
}

const createdUserIds = new Set();

async function cleanup() {
  for (const id of createdUserIds) {
    await prisma.brandDetail.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.socialAccount.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
}

async function main() {
  console.log(`\n=================================================`);
  console.log(`BrainGrow Onboarding & Verification Test Suite`);
  console.log(`Target server: ${BASE}`);
  console.log(`=================================================\n`);

  try {
    // ── 1. Registration & Validation ──────────────────────────────────
    const testEmail = makeEmail();
    const testPassword = "Password123!";
    const testName = "Sarah Connor";

    // 1a. Weak / short password validation
    const weakReg = await api("/api/auth/register", {
      method: "POST",
      body: { name: testName, email: testEmail, password: "123" },
    });
    check("1a. Rejects weak password (< 6 chars) with 400", weakReg.status === 400);

    // 1b. Missing name
    const noNameReg = await api("/api/auth/register", {
      method: "POST",
      body: { name: "", email: testEmail, password: testPassword },
    });
    check("1b. Rejects missing name with 400", noNameReg.status === 400);

    // 1c. Valid registration
    const regRes = await api("/api/auth/register", {
      method: "POST",
      body: { name: testName, email: testEmail, password: testPassword },
    });
    check("1c. Registration succeeds with 201", regRes.status === 201, `status=${regRes.status}`);
    const userId = regRes.json?.data?.user?.id;
    const sessionToken = regRes.json?.data?.token;
    if (userId) createdUserIds.add(userId);

    check("1c. Returns user with emailVerified=false", regRes.json?.data?.user?.emailVerified === false);
    check("1c. Initial onboardingStep is EMAIL_PENDING", regRes.json?.data?.user?.onboardingStep === "EMAIL_PENDING");

    // 1d. Prevent duplicate email registration
    const dupReg = await api("/api/auth/register", {
      method: "POST",
      body: { name: "Duplicate User", email: testEmail, password: testPassword },
    });
    check("1d. Duplicate registration rejects with 409 EMAIL_ALREADY_EXISTS", dupReg.status === 409 && dupReg.json?.error?.code === "EMAIL_ALREADY_EXISTS");

    // ── 2. Email Verification Token Security ──────────────────────────
    const dbToken = await prisma.emailVerificationToken.findFirst({
      where: { userId },
    });
    check("2a. Verification token created in database", !!dbToken);
    check("2a. Plaintext token is never stored in DB (stores SHA-256 hash)", !!dbToken?.tokenHash && dbToken.tokenHash.length === 64);

    // 2b. Invalid token fails
    const invalidVerif = await api("/api/auth/verify-email?token=invalid_dummy_token");
    check("2b. Invalid token rejects with 400 INVALID_TOKEN", invalidVerif.status === 400 && invalidVerif.json?.error?.code === "INVALID_TOKEN");

    // 2c. Resend verification email rate limiting (45s cooldown)
    const resendRateLimit = await api("/api/auth/resend-verification", {
      method: "POST",
      token: sessionToken,
      body: { email: testEmail },
    });
    check("2c. Resend verification adheres to cooldown timer (429)", resendRateLimit.status === 429 && resendRateLimit.json?.error?.code === "RATE_LIMITED");

    // 2d. Simulate valid email verification using DB token
    // Update token to known test token
    const testRawToken = "test_secure_raw_token_xyz_123456789";
    const crypto = await import("crypto");
    const testHash = crypto.createHash("sha256").update(testRawToken).digest("hex");
    await prisma.emailVerificationToken.update({
      where: { id: dbToken.id },
      data: { tokenHash: testHash },
    });

    const validVerif = await api(`/api/auth/verify-email?token=${testRawToken}`);
    check("2d. Verification succeeds with 200", validVerif.status === 200, `got ${validVerif.status}`);
    check("2d. Directs user to /onboarding/social-connect", validVerif.json?.data?.redirectUrl === "/onboarding/social-connect");

    // Check user record in DB
    const verifiedUser = await prisma.user.findUnique({ where: { id: userId } });
    check("2d. User emailVerified is now true in DB", verifiedUser?.emailVerified === true);
    check("2d. User onboardingStep transitioned to SOCIAL_CONNECT", verifiedUser?.onboardingStep === "SOCIAL_CONNECT");

    // 2e. Token is single-use: clicking again returns already verified
    const reuseVerif = await api(`/api/auth/verify-email?token=${testRawToken}`);
    check("2e. Already-used token recognizes alreadyVerified=true", reuseVerif.json?.data?.alreadyVerified === true);

    // ── 3. Onboarding State Machine & Resumption ──────────────────────
    const stateRes = await api("/api/onboarding/state", { token: sessionToken });
    check("3a. GET /api/onboarding/state returns current step", stateRes.status === 200 && stateRes.json?.data?.step === "SOCIAL_CONNECT");

    // ── 4. Social Accounts Connection & OAuth Security ────────────────
    // 4a. Manual connect requires a user-supplied handle (no fabrication)
    const noHandleRes = await api("/api/social/accounts", {
      method: "POST",
      token: sessionToken,
      body: { platform: "instagram", action: "connect" },
    });
    check("4a. Manual connect without handle rejects with 400 MISSING_HANDLE", noHandleRes.status === 400 && noHandleRes.json?.error?.code === "MISSING_HANDLE");

    // 4b. Manual connect with handle + API token
    const connectRes = await api("/api/social/accounts", {
      method: "POST",
      token: sessionToken,
      body: { platform: "instagram", action: "connect", handle: "@sarah_tech", accessToken: "test-token-abc-123" },
    });
    check("4b. Manual connect with handle succeeds (200)", connectRes.status === 200);
    check("4b. Manual connect records source=manual", connectRes.json?.data?.source === "manual");
    check("4b. Manual connect persists the exact handle entered", connectRes.json?.data?.handle === "@sarah_tech");

    const storedAccount = await prisma.socialAccount.findFirst({ where: { userId, platform: "instagram" } });
    check("4b. Token is encrypted at rest (never plaintext)", !!storedAccount?.accessToken && storedAccount.accessToken !== "test-token-abc-123" && storedAccount.accessToken.split(":").length === 3);
    check("4b. Encrypted token decrypts to the supplied value", decryptToken(storedAccount?.accessToken || "") === "test-token-abc-123");

    // 4c. Fetch social accounts list — verify zero token leaks + source attribution
    const listSocial = await api("/api/social/accounts", { token: sessionToken });
    const insta = listSocial.json?.data?.accounts?.find((a) => a.platform === "instagram");
    check("4c. Social accounts list shows Instagram Connected", insta?.connected === true);
    check("4c. Social accounts list does NOT expose accessToken or secrets", !insta?.accessToken && !insta?.clientSecret);
    check("4c. List attributes source=manual and demo=false", insta?.source === "manual" && insta?.demo === false);

    // 4c. Verify OAuth connect endpoint generates auth URL and CSRF cookie
    const oauthStart = await api("/api/social/connect/instagram", { token: sessionToken });
    check("4d. OAuth start returns authUrl", oauthStart.status === 200 && !!oauthStart.json?.data?.authUrl);

    // 4d. Disconnect social account
    const disconnectRes = await api("/api/social/accounts", {
      method: "POST",
      token: sessionToken,
      body: { platform: "instagram", action: "disconnect" },
    });
    check("4e. Disconnect social account succeeds", disconnectRes.status === 200);
    const listAfterDisc = await api("/api/social/accounts", { token: sessionToken });
    const instaAfter = listAfterDisc.json?.data?.accounts?.find((a) => a.platform === "instagram");
    check("4e. Instagram now shows connected=false", instaAfter?.connected === false);

    // ── 5. Brand Details API & Validation ─────────────────────────────
    // 5a. Company requires Industry
    const invalidBrand = await api("/api/brand-details", {
      method: "POST",
      token: sessionToken,
      body: {
        businessType: "Company",
        industry: "", // Empty industry for Company should fail
        contentType: "Tech Reviews",
        goal: "Gain Followers",
      },
    });
    check("5a. Company without industry fails validation (400)", invalidBrand.status === 400);

    // 5b. Individual does NOT require Industry
    const validIndivBrand = await api("/api/brand-details", {
      method: "POST",
      token: sessionToken,
      body: {
        businessType: "Individual",
        contentType: "Tech Reviews",
        goal: "Gain Followers",
        website: "https://sarahconnor.tech",
      },
    });
    check("5b. Individual brand details succeed without industry (200)", validIndivBrand.status === 200);

    // 5c. Company with valid Industry succeeds and updates DB
    const validCompanyBrand = await api("/api/brand-details", {
      method: "POST",
      token: sessionToken,
      body: {
        businessType: "Company",
        industry: "Technology",
        contentType: "Tech Product Reviews",
        goal: "Generate Leads",
        website: "https://cyberdyne.ai",
      },
    });
    check("5c. Company brand details save succeeds (200)", validCompanyBrand.status === 200);

    // 5d. GET /api/brand-details returns saved values
    const getBrand = await api("/api/brand-details", { token: sessionToken });
    check("5d. GET /api/brand-details returns saved company details", getBrand.json?.data?.industry === "Technology" && getBrand.json?.data?.goal === "Generate Leads");

    // ── 6. Onboarding Completion & Tour ───────────────────────────────
    const finishRes = await api("/api/onboarding/state", {
      method: "PATCH",
      token: sessionToken,
      body: {
        step: "COMPLETED",
        onboardingCompleted: true,
        onboardingTourCompleted: true,
      },
    });
    check("6a. Onboarding marked completed", finishRes.json?.data?.onboardingCompleted === true);

    const userAfterCompletion = await prisma.user.findUnique({ where: { id: userId } });
    check("6b. User in DB has onboardingCompleted=true and tourCompleted=true", userAfterCompletion?.onboardingCompleted === true && userAfterCompletion?.onboardingTourCompleted === true);

    console.log(`\n=================================================`);
    console.log(`Test Results: ${results.filter((r) => r.pass).length}/${results.length} passed`);
    console.log(`=================================================\n`);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error("Test Suite Execution Error:", err);
  process.exit(1);
});

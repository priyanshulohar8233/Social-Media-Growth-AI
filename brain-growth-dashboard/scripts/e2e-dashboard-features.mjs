import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as https from "https";
import * as http from "http";

const PORT = process.env.PORT || 8080;
const BASE = `http://localhost:${PORT}`;
const prisma = new PrismaClient();

// Load same env as the app
function loadEnv() {
  try {
    const text = fs.readFileSync(".env", "utf-8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
loadEnv();
const JWT_SECRET = process.env.JWT_SECRET;

const identity = `dash-${Math.random().toString(36).slice(2, 9)}`;
const password = "Test@12345";
let companyId = "";
let token = "";
let cookie = "";

let pass = 0;
let fail = 0;
const results = [];

function ok(cond, msg) {
  if (cond) {
    pass++;
    results.push(`PASS  ${msg}`);
  } else {
    fail++;
    results.push(`FAIL  ${msg}`);
  }
}

function request(path, { method = "GET", body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = `${BASE}${path}`;
    const data = body ? JSON.stringify(body) : null;
    const h = { ...(data ? { "Content-Type": "application/json" } : {}), ...headers };
    if (data) h["Content-Length"] = Buffer.byteLength(data);
    const req = (url.startsWith("https") ? https : http).request(url, { method, headers: h }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(raw);
        } catch {}
        resolve({ status: res.statusCode, json, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function sign(claims) {
  const enc = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
  const h = enc({ alg: "HS256", typ: "JWT" });
  const p = enc(claims);
  const crypto = await import("node:crypto");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${sig}`;
}

(async () => {
  try {
    // 1. Register a fresh user (real flow)
    const reg = await request("/api/auth/register", {
      method: "POST",
      body: { name: `Dash Tester`, email: `${identity}@test.dev`, password },
    });
    ok(reg.status === 200, `register → ${reg.status}`);
    token = reg.json?.token;
    const setCookie = reg.headers?.["set-cookie"]?.[0] || "";
    cookie = setCookie.split(";")[0];
    ok(!!token && !!cookie, "register returns token + cookie");

    const auth = {
      cookie: { Cookie: cookie },
      bearer: { Authorization: `Bearer ${token}`, Cookie: cookie },
    };

    // 2. Create a BUSINESS workspace
    const comp = await request("/api/companies", {
      method: "POST",
      headers: auth.bearer,
      body: { name: `Dash Workspace ${identity}`, industry: "Technology", profileType: "BUSINESS" },
    });
    ok(comp.status === 201, `create workspace → ${comp.status}`);
    companyId = comp.json?.company?.id;
    ok(!!companyId, "company id returned");

    // 3. Seed demo data (real DB writes)
    const seed = await request(`/api/companies/${companyId}/seed`, { method: "POST", headers: auth.bearer });
    ok(seed.status === 200 && seed.json?.seeded === true, `seed → seeded=${seed.json?.seeded}`);
    ok(seed.status === 200 && seed.json?.counts?.contents > 0, `seed contents=${seed.json?.counts?.contents}`);

    // Verify rows landed in DB
    const [dbEvents, dbContent, dbAccounts] = await Promise.all([
      prisma.analyticsEvent.count({ where: { companyId } }),
      prisma.content.count({ where: { companyId } }),
      prisma.socialAccount.count({ where: { companyId } }),
    ]);
    ok(dbEvents > 100, `DB analytics events = ${dbEvents}`);
    ok(dbContent >= 14, `DB contents = ${dbContent}`);
    ok(dbAccounts >= 6, `DB social accounts = ${dbAccounts}`);

    // Re-seed without force is idempotent
    const reseed = await request(`/api/companies/${companyId}/seed`, { method: "POST", headers: auth.bearer });
    ok(reseed.json?.seeded === false, `re-seed idempotent → ${reseed.json?.reason}`);

    // 4. Dashboard aggregate
    const dash = await request(`/api/companies/${companyId}/dashboard`, { headers: auth.bearer });
    ok(dash.status === 200, `dashboard → ${dash.status}`);
    ok(dash.json?.company?.name.includes(identity), "dashboard company name matches");
    ok(Array.isArray(dash.json?.kpis) && dash.json.kpis.length === 6, `dashboard kpis = ${dash.json?.kpis?.length}`);
    ok(typeof dash.json?.kpis?.[0]?.value === "string" && Array.isArray(dash.json?.kpis?.[0]?.spark) && dash.json.kpis[0].spark.length === 30, "kpi value+spark(30) present");
    ok(Array.isArray(dash.json?.performance) && dash.json.performance.length > 0, `performance series = ${dash.json?.performance?.length}`);
    ok(Array.isArray(dash.json?.platforms) && dash.json.platforms.length >= 1, `platforms = ${dash.json?.platforms?.length}`);
    ok(Array.isArray(dash.json?.topContent) && dash.json.topContent.length > 0, `topContent = ${dash.json?.topContent?.length}`);
    ok(Array.isArray(dash.json?.recentActivity) && dash.json.recentActivity.length > 0, `recentActivity = ${dash.json?.recentActivity?.length}`);
    ok((dash.json?.calendar?.days?.length ?? 0) === 7, "calendar days = 7");
    ok(Array.isArray(dash.json?.recommendations) && dash.json.recommendations.length >= 1, `recommendations = ${dash.json?.recommendations?.length}`);
    ok(typeof dash.json?.audience?.total === "number" && dash.json.audience.total > 0, `audience total = ${dash.json?.audience?.total}`);

    // 401 without auth for a real endpoint
    const noAuth = await request(`/api/companies/${companyId}/dashboard`);
    ok(noAuth.status === 401, `dashboard unauth → ${noAuth.status}`);

    // 5. Audience endpoint
    const aud = await request(`/api/companies/${companyId}/audience`, { headers: auth.bearer });
    ok(aud.status === 200, `audience → ${aud.status}`);
    ok(aud.json?.summary?.totalFollowers > 0, `audience followers = ${aud.json?.summary?.totalFollowers}`);
    ok(Array.isArray(aud.json?.demographics?.age) && aud.json.demographics.age.length >= 3, "audience age demographics");
    ok(Array.isArray(aud.json?.activeHours) && aud.json.activeHours.length >= 5, `activeHours = ${aud.json?.activeHours?.length}`);
    ok(Array.isArray(aud.json?.interests) && aud.json.interests.length >= 3, `interests = ${aud.json?.interests?.length}`);

    // 6. Content endpoint (existing real) — fetch + create
    const contentList = await request(`/api/companies/${companyId}/content`, { headers: auth.bearer });
    ok(contentList.status === 200 && contentList.json?.contents?.length > 0, `content list = ${contentList.json?.contents?.length}`);
    const created = await request(`/api/companies/${companyId}/content`, {
      method: "POST",
      headers: auth.bearer,
      body: { title: "E2E test post", platform: "instagram", contentType: "POST" },
    });
    ok(created.status === 201, `content create → ${created.status}`);
    const createdId = created.json?.content?.id;
    const afterCreate = await prisma.content.findUnique({ where: { id: createdId } });
    ok(!!afterCreate && afterCreate.status === "DRAFT", "content persisted as DRAFT in DB");

    // 7. Growth endpoint
    const growth = await request(`/api/companies/${companyId}/growth`, { headers: auth.bearer });
    ok(growth.status === 200, `growth → ${growth.status}`);
    ok(growth.json?.opportunities?.length > 0 && growth.json?.nextBestActions?.length > 0, "growth opportunities + NBA present");

    // 8. Analytics endpoint (existing real)
    const analytics = await request(`/api/companies/${companyId}/analytics`, { headers: auth.bearer });
    ok(analytics.status === 200, `analytics → ${analytics.status}`);
    ok(analytics.json?.summary?.totalViews > 0, `analytics views = ${analytics.json?.summary?.totalViews}`);

    // 9. AI chat with brain context
    const ai = await request(`/api/companies/${companyId}/ai/chat`, {
      method: "POST",
      headers: auth.bearer,
      body: { message: "Give me content ideas for my tech brand" },
    });
    ok(ai.status === 200, `ai chat → ${ai.status}`);
    ok(typeof ai.json?.response === "string" && ai.json.response.length > 40, "ai response is substantive");
    ok(ai.json.response.includes("content"), "ai response references content ideas");
    const aiTrend = await request(`/api/companies/${companyId}/ai/chat`, {
      method: "POST",
      headers: auth.bearer,
      body: { message: "What trends are hot right now?" },
    });
    ok(aiTrend.json?.response?.toLowerCase().includes("trend"), "ai response reflects trends");

    // 10. Social accounts connect/disconnect
    const accs1 = await request(`/api/companies/${companyId}/social-accounts`, { headers: auth.bearer });
    ok(accs1.status === 200 && accs1.json?.accounts?.length >= 6, `accounts list = ${accs1.json?.accounts?.length}`);
    const disc = await request(`/api/companies/${companyId}/social-accounts`, {
      method: "POST",
      headers: auth.bearer,
      body: { platform: "instagram", action: "disconnect" },
    });
    ok(disc.status === 200, `disconnect → ${disc.status}`);
    const accs2 = await request(`/api/companies/${companyId}/social-accounts`, { headers: auth.bearer });
    const ig = accs2.json?.accounts?.find((a) => a.platform === "instagram");
    ok(ig?.status === "disconnected", "instagram now disconnected");
    const conn = await request(`/api/companies/${companyId}/social-accounts`, {
      method: "POST",
      headers: auth.bearer,
      body: { platform: "instagram", action: "connect" },
    });
    ok(conn.status === 201, `reconnect → ${conn.status}`);

    // 11. PATCH /api/auth/me (settings profile save)
    const patch = await request("/api/auth/me", {
      method: "PATCH",
      headers: auth.bearer,
      body: { name: `Renamed ${identity}` },
    });
    ok(patch.status === 200 && patch.json?.user?.name.includes("Renamed"), `patch /auth/me → ${patch.status}`);
    const me = await request("/api/auth/me", { headers: auth.bearer });
    ok(me.json?.user?.name.includes("Renamed"), "name persisted (auth/me)");

    // 12. Tenant isolation — non-member gets 403
    const otherToken = await sign({ userId: "2033d739-0000-4a78-a4c0-rigged", email: "rigged@test.dev" });
    const foreign = await request(`/api/companies/${companyId}/dashboard`, { headers: { Authorization: `Bearer ${otherToken}` } });
    ok(foreign.status === 403, `non-member dashboard → ${foreign.status}`);

    // Clean up: delete company (cascade removes children), keep DB clean
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.user.deleteMany({ where: { email: `${identity}@test.dev` } });

    const [users, companies] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
    ]);
    ok(users === 1 && companies === 1, `cleanup → users=${users} companies=${companies}`);
  } catch (e) {
    fail++;
    results.push(`FAIL  unexpected error: ${e?.message || e}`);
    // best-effort cleanup
    if (companyId) {
      await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { email: `${identity}@test.dev` } }).catch(() => {});
    }
  } finally {
    await prisma.$disconnect();
    console.log(results.join("\n"));
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail > 0 ? 1 : 0);
  }
})();
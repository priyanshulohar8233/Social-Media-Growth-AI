/**
 * Moat-phase end-to-end suite (PDF Part A/B: Phase 1 cron/health, Phase 2 GEO,
 * Phase 4 MCP/predictive/crisis/savings). All assertions run against real rows.
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as https from "https";
import * as http from "http";

const PORT = process.env.PORT || 8080;
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;
const PROTECTION_BYPASS = process.env.PROTECTION_BYPASS || "";
const prisma = new PrismaClient();

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
const CRON_SECRET = (process.env.CRON_SECRET || "").trim();

const identity = `moat-${Math.random().toString(36).slice(2, 9)}`;
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
    const sep = path.includes("?") ? "&" : "?";
    const url = `${BASE}${path}` + (PROTECTION_BYPASS ? `${sep}x-vercel-protection-bypass=${PROTECTION_BYPASS}` : "");
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

(async () => {
  let usersBefore = 0;
  let companiesBefore = 0;
  try {
    [usersBefore, companiesBefore] = await Promise.all([prisma.user.count(), prisma.company.count()]);

    // 0. Extended health (public) — dependency checks, no secret values
    const health = await request("/api/health");
    ok(health.status === 200 && health.json?.ok === true, "health ok");
    ok(health.json?.checks?.db === "up", `health db = ${health.json?.checks?.db}`);
    ok(typeof health.json?.checks?.queuedJobs === "number", "health queue depth present");
    const prov = health.json?.checks?.providers || {};
    ok(typeof prov.openai === "boolean" && typeof prov.freellmapi === "boolean", "health provider presence flags");
    ok(!JSON.stringify(prov).includes("sk-"), "health leaks no secret values");

    // 1. Cron guard behavior
    const cronNoAuth = await request("/api/cron/process-jobs", { method: "POST", body: {} });
    if (CRON_SECRET) {
      ok(cronNoAuth.status === 401, `cron without secret → ${cronNoAuth.status}`);
      const cronOk = await request("/api/cron/process-jobs", {
        method: "POST",
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
        body: { tasks: ["jobs"], batch: 2 },
      });
      ok(cronOk.status === 200 && cronOk.json?.success === true, "cron drain with secret works");
      ok(typeof cronOk.json?.data?.jobs?.processed === "number", "cron drain reports counts");
    } else {
      ok(cronNoAuth.status === 503, `cron unconfigured → ${cronNoAuth.status} (set CRON_SECRET to enable)`);
    }

    // 2. Register + workspace + seed
    const reg = await request("/api/auth/register", {
      method: "POST",
      body: { name: "Moat Tester", email: `${identity}@test.dev`, password },
    });
    ok(reg.status === 201, `register → ${reg.status}`);
    token = reg.json?.token || reg.json?.data?.token;
    cookie = ((reg.headers?.["set-cookie"]?.[0] || "").split(";")[0]);
    const auth = { Authorization: `Bearer ${token}`, Cookie: cookie };
    const comp = await request("/api/companies", {
      method: "POST",
      headers: auth,
      body: { name: `Moat WS ${identity}`, profileType: "BUSINESS" },
    });
    companyId = comp.json?.company?.id;
    ok(!!companyId, "company id returned");
    await request(`/api/companies/${companyId}/seed`, { method: "POST", headers: auth });

    // 3. GEO sweep -> rows, coverage, war-room fusion
    const sweep = await request(`/api/companies/${companyId}/competitors/geo`, { method: "POST", headers: auth });
    ok(sweep.status === 201, `geo sweep → ${sweep.status}`);
    ok(sweep.json?.data?.rows === 3, `geo rows = ${sweep.json?.data?.rows}`);
    ok(typeof sweep.json?.data?.provider === "string", "geo provider attributed");
    const geoList = await request(`/api/companies/${companyId}/competitors/geo`, { headers: auth });
    ok(geoList.status === 200 && geoList.json?.rows?.length === 3, "geo rows listed");
    ok(typeof geoList.json?.coverage?.share === "number" || geoList.json?.coverage?.share === null, "geo coverage computed");
    const war = await request(`/api/companies/${companyId}/competitors/war-room`, { headers: auth });
    ok(war.status === 200 && ("geoShareOfVoice" in (war.json || {})), "war-room fuses geoShareOfVoice");

    // 4. MCP tools
    const mcpList = await request("/api/mcp");
    ok(mcpList.status === 200 && mcpList.json?.tools?.length === 4, "mcp lists 4 tools");
    const mcpCreate = await request("/api/mcp", {
      method: "POST",
      headers: auth,
      body: { tool: "createContent", args: { companyId, title: "MCP draft", platform: "linkedin" } },
    });
    ok(mcpCreate.status === 201 && mcpCreate.json?.data?.status === "DRAFT", "mcp createContent drafts");
    const mcpAnalytics = await request("/api/mcp", {
      method: "POST",
      headers: auth,
      body: { tool: "getAnalytics", args: { companyId } },
    });
    ok(mcpAnalytics.status === 200 && typeof mcpAnalytics.json?.data?.totals?.views === "number", "mcp getAnalytics totals");
    const mcpWar = await request("/api/mcp", {
      method: "POST",
      headers: auth,
      body: { tool: "warRoomReport", args: { companyId } },
    });
    ok(mcpWar.status === 200 && Array.isArray(mcpWar.json?.data?.competitors), "mcp warRoomReport works");
    const mcpPub = await request("/api/mcp", {
      method: "POST",
      headers: auth,
      body: { tool: "publishPost", args: { companyId, title: "MCP queued", platform: "linkedin" } },
    });
    ok(mcpPub.status === 201 && mcpPub.json?.data?.scheduled === true && mcpPub.json?.data?.live === false, "mcp publishPost queues honestly (live=false)");
    const mcpBad = await request("/api/mcp", { method: "POST", headers: auth, body: { tool: "nope", args: { companyId } } });
    ok(mcpBad.status === 400, "mcp unknown tool → 400");
    const mcpUnauth = await request("/api/mcp", { method: "POST", body: { tool: "getAnalytics", args: { companyId } } });
    ok(mcpUnauth.status === 401, "mcp unauth → 401");

    // 5. Growth prediction shape
    const growth = await request(`/api/companies/${companyId}/growth`, { headers: auth });
    ok(growth.status === 200 && growth.json?.prediction && "viralityScore" in growth.json.prediction && "bestTime" in growth.json.prediction && "forecastReach" in growth.json.prediction, "growth prediction block present");

    // 6. Crisis detection + auto-draft (F64)
    for (let i = 0; i < 3; i++) {
      await request(`/api/companies/${companyId}/inbox`, {
        method: "POST",
        headers: auth,
        body: { platform: "instagram", channelType: "comment", content: `This is terrible, awful, worst product ever, I want a refund now ${i}`, authorHandle: `@angry${i}` },
      });
    }
    const alerts = await request(`/api/companies/${companyId}/inbox/alerts`, { headers: auth });
    ok(alerts.status === 200 && alerts.json?.crisis?.alert === true, `crisis alert fires (negatives=${alerts.json?.crisis?.negatives})`);
    ok(alerts.json?.crisis?.threshold === 3, "crisis threshold reported");
    const draft = await request(`/api/companies/${companyId}/inbox/alerts`, { method: "POST", headers: auth });
    ok(draft.status === 200 && draft.json?.data?.drafted >= 3, `auto-draft drafted=${draft.json?.data?.drafted}`);

    // 7. Usage savings block
    const usage = await request(`/api/companies/${companyId}/usage`, { headers: auth });
    ok(usage.status === 200 && typeof usage.json?.savings?.totalSaved === "number", `usage savings totalSaved=${usage.json?.savings?.totalSaved}`);
    ok(usage.json?.savings?.referenceRatePer1k === 0.003 && Array.isArray(usage.json?.savings?.byProvider), "usage savings breakdown present");

    // Cleanup
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.user.deleteMany({ where: { email: `${identity}@test.dev` } });
    const [users, companies, geoLeft] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.geoVisibility.count({ where: { companyId } }),
    ]);
    ok(users === usersBefore && companies === companiesBefore, `cleanup → users=${users} companies=${companies}`);
    ok(geoLeft === 0, "no orphaned geo rows after cleanup");
  } catch (e) {
    fail++;
    results.push(`FAIL  unexpected error: ${e?.message || e}`);
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

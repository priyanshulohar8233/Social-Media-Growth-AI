import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as http from "http";

const PORT = process.env.PORT || 8080;
const BASE = `http://localhost:${PORT}`;
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
const JWT_SECRET = process.env.JWT_SECRET;

const identity = `ops-${Math.random().toString(36).slice(2, 9)}`;
const password = "Test@12345";
let companyId = "";
let token = "";
let cookie = "";
let viewerToken = "";

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
    const req = http.request(url, { method, headers: h }, (res) => {
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
    // 1. Register owner
    const reg = await request("/api/auth/register", {
      method: "POST",
      body: { name: `Ops Tester`, email: `${identity}@test.dev`, password },
    });
    ok(reg.status === 200, `register → ${reg.status}`);
    token = reg.json?.token;
    cookie = (reg.headers?.["set-cookie"]?.[0] || "").split(";")[0];
    ok(!!token && !!cookie, "register returns token + cookie");
    const ownerAuth = { Authorization: `Bearer ${token}`, Cookie: cookie };

    const comp = await request("/api/companies", {
      method: "POST",
      headers: ownerAuth,
      body: { name: `Ops WS ${identity}`, profileType: "BUSINESS" },
    });
    ok(comp.status === 201, `create workspace → ${comp.status}`);
    companyId = comp.json?.company?.id;
    ok(!!companyId, "company id returned");
    await request(`/api/companies/${companyId}/seed`, { method: "POST", headers: ownerAuth });

    // 2. Generation through the gateway (default/BEST_AVAILABLE → mock fallback)
    const gen = await request(`/api/companies/${companyId}/generation`, {
      method: "POST",
      headers: ownerAuth,
      body: { kind: "TEXT", prompt: "Write a short Instagram caption about morning routines" },
    });
    ok(gen.status === 201, `generation → ${gen.status}`);
    ok(gen.json?.job?.status === "COMPLETED", `job status = ${gen.json?.job?.status}`);
    ok(typeof gen.json?.job?.output === "string" && gen.json.job.output.length > 20, "job output is substantive text");
    ok(Number.isInteger(gen.json?.job?.attempts) && gen.json.job.attempts >= 1, `job attempts = ${gen.json?.job?.attempts}`);
    ok(Number.isInteger(gen.json?.job?.tokensUsed), `job tokensUsed recorded = ${gen.json?.job?.tokensUsed}`);

    // AiUsage rows were recorded by the gateway
    const usageRows = await prisma.aiUsage.count({ where: { companyId } });
    ok(usageRows >= 1, `aiUsage rows = ${usageRows}`);
    const usageAgg = await prisma.aiUsage.aggregate({ where: { companyId }, _sum: { cost: true } });
    ok(typeof usageAgg._sum.cost === "number", "aiUsage cost summed");

    // 3. Usage endpoint (real sidebar/header data)
    const usage = await request(`/api/companies/${companyId}/usage`, { headers: ownerAuth });
    ok(usage.status === 200, `usage → ${usage.status}`);
    ok(usage.json?.usage?.totalCalls >= 1, `usage.totalCalls = ${usage.json?.usage?.totalCalls}`);
    ok(typeof usage.json?.content?.total === "number", "usage.content.total present");

    // 4. Memory create → verify (PATCH) → delete (DELETE) as OWNER
    const mem = await request(`/api/companies/${companyId}/memories`, {
      method: "POST",
      headers: ownerAuth,
      body: { type: "VERIFIED_FACT", content: "Ops e2e memory" },
    });
    ok(mem.status === 201, `memory create → ${mem.status}`);
    const memId = mem.json?.memory?.id;
    ok(!!memId, "memory id returned");
    ok(mem.json?.memory?.verificationStatus === "PENDING", `memory starts PENDING = ${mem.json?.memory?.verificationStatus}`);
    const verify = await request(`/api/companies/${companyId}/memories/${memId}`, {
      method: "PATCH",
      headers: ownerAuth,
      body: { verificationStatus: "VERIFIED" },
    });
    ok(verify.status === 200 && verify.json?.memory?.verificationStatus === "VERIFIED", `memory verified → ${verify.json?.memory?.verificationStatus}`);
    const memInDb = await prisma.memory.findUnique({ where: { id: memId } });
    ok(memInDb?.verifiedBy === reg.json?.user?.id, `verifiedBy recorded = ${memInDb?.verifiedBy === reg.json?.user?.id}`);

    // 5. RBAC — VIEWER is blocked from memory.manage and approval.manage
    const viewer = await request("/api/auth/register", {
      method: "POST",
      body: { name: "Ops Viewer", email: `viewer-${identity}@test.dev`, password },
    });
    viewerToken = viewer.json?.token;
    const viewerAuth = { Authorization: `Bearer ${viewerToken}` };
    await prisma.membership.create({
      data: { companyId, userId: viewer.json?.user?.id, role: "VIEWER" },
    });
    const denyDelete = await request(`/api/companies/${companyId}/memories/${memId}`, { method: "DELETE", headers: viewerAuth });
    ok(denyDelete.status === 403, `viewer memory delete → ${denyDelete.status}`);
    const denyApproval = await request(`/api/companies/${companyId}/approvals/${"none"}`, { method: "DELETE", headers: viewerAuth });
    ok(denyApproval.status === 403, `viewer approval delete → ${denyApproval.status}`);
    const ownerDelete = await request(`/api/companies/${companyId}/memories/${memId}`, { method: "DELETE", headers: ownerAuth });
    ok(ownerDelete.status === 200, `owner memory delete → ${ownerDelete.status}`);

    // 6. Approvals [id] decision flow (own + ADMIN) and verified learning
    const created = await request(`/api/companies/${companyId}/content`, {
      method: "POST",
      headers: ownerAuth,
      body: { title: "Awaiting approval", platform: "linkedin", contentType: "POST" },
    });
    const contentId = created.json?.content?.id;
    const apr = await request(`/api/companies/${companyId}/approvals`, {
      method: "POST",
      headers: ownerAuth,
      body: { contentId, action: "approve" },
    });
    ok(apr.status === 200, `approval create → ${apr.status}`);
    const approvalId = apr.json?.approval?.id;
    ok(!!approvalId, "approval id returned");

    const approved = await request(`/api/companies/${companyId}/approvals/${approvalId}`, {
      method: "PATCH",
      headers: ownerAuth,
      body: { action: "approve", comments: "Looks great" },
    });
    ok(approved.status === 200, `approval decide → ${approved.status}`);
    ok(approved.json?.approval?.status === "APPROVED", `approval status = ${approved.json?.approval?.status}`);
    const contentAfter = await prisma.content.findUnique({ where: { id: contentId } });
    ok(contentAfter?.status === "APPROVED", `content status becomes APPROVED = ${contentAfter?.status}`);
    const decisionMem = await prisma.memory.findFirst({ where: { companyId, type: "DECISION_HISTORY", source: `approval:${approvalId}` } });
    ok(!!decisionMem && decisionMem.verificationStatus === "VERIFIED", "approved decision recorded as VERIFIED memory");

    const approvalGet = await request(`/api/companies/${companyId}/approvals/${approvalId}`, { headers: ownerAuth });
    ok(approvalGet.status === 200 && approvalGet.json?.approval?.status === "APPROVED", `approval GET → ${approvalGet.status}`);

    // 7. Leads pipeline
    const lead = await request(`/api/companies/${companyId}/leads`, {
      method: "POST",
      headers: ownerAuth,
      body: { name: "Ops Lead", email: "lead@test.dev", source: "e2e" },
    });
    ok(lead.status === 201, `lead create → ${lead.status}`);
    const leadId = lead.json?.lead?.id;
    const wonPatch = await request(`/api/companies/${companyId}/leads/${leadId}`, {
      method: "PATCH",
      headers: ownerAuth,
      body: { status: "won", value: 5000 },
    });
    ok(wonPatch.status === 200 && wonPatch.json?.lead?.status === "won", `lead won → ${wonPatch.json?.lead?.status}`);
    const conversions = await prisma.conversion.count({ where: { leadId } });
    ok(conversions === 1, `conversion recorded = ${conversions}`);
    const leadsGet = await request(`/api/companies/${companyId}/leads`, { headers: ownerAuth });
    ok(leadsGet.status === 200 && leadsGet.json?.byStatus?.some((b) => b._count.id > 0), "leads byStatus present");
    const leadDel = await request(`/api/companies/${companyId}/leads/${leadId}`, { method: "DELETE", headers: ownerAuth });
    ok(leadDel.status === 200, `lead delete → ${leadDel.status}`);

    // 8. Calendar + Competitors pages (GET + create + competitor delete)
    const cal = await request(`/api/companies/${companyId}/calendar?month=9&year=2026`, { headers: ownerAuth });
    ok(cal.status === 200, `calendar → ${cal.status}`);
    const calAdd = await request(`/api/companies/${companyId}/calendar`, {
      method: "POST",
      headers: ownerAuth,
      body: { month: 9, year: 2026, date: "2026-09-20", platform: "instagram", title: "Fall promo" },
    });
    ok(calAdd.status === 201 && calAdd.json?.item?.id, `calendar add → ${calAdd.status}`);

    const comps = await request(`/api/companies/${companyId}/competitors`, { headers: ownerAuth });
    ok(comps.status === 200, `competitors → ${comps.status}`);
    const compAdd = await request(`/api/companies/${companyId}/competitors`, {
      method: "POST",
      headers: ownerAuth,
      body: { name: "Ops Rival", handle: "@rival", platform: "instagram" },
    });
    ok(compAdd.status === 201, `competitor add → ${compAdd.status}`);
    const compMem = await prisma.memory.findFirst({ where: { companyId, type: "COMPETITOR_OBSERVATION" } });
    ok(!!compMem, "competitor observation recorded in brain");
    const compId = compAdd.json?.competitor?.id;
    const compDel = await request(`/api/companies/${companyId}/competitors/${compId}`, { method: "DELETE", headers: ownerAuth });
    ok(compDel.status === 200, `competitor delete → ${compDel.status}`);

    // 9. Jobs/process — drain endpoint shape
    const drain = await request("/api/jobs/process?batch=3", { method: "POST", headers: ownerAuth });
    ok(drain.status === 200 && Number.isInteger(drain.json?.processed), `jobs/process → ${drain.status} processed=${drain.json?.processed}`);
    const drainUnauth = await request("/api/jobs/process", { method: "POST" });
    ok(drainUnauth.status === 401, `jobs/process unauth → ${drainUnauth.status}`);

    // Cleanup: delete company (cascade) + test users
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.user.deleteMany({ where: { email: { in: [`${identity}@test.dev`, `viewer-${identity}@test.dev`] } } });

    const [users, companies] = await Promise.all([prisma.user.count(), prisma.company.count()]);
    ok(users === 1 && companies === 1, `cleanup → users=${users} companies=${companies}`);
  } catch (e) {
    fail++;
    results.push(`FAIL  unexpected error: ${e?.message || e}`);
    if (companyId) {
      await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { email: { in: [`${identity}@test.dev`, `viewer-${identity}@test.dev`] } } }).catch(() => {});
    }
  } finally {
    await prisma.$disconnect();
    console.log(results.join("\n"));
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail > 0 ? 1 : 0);
  }
})();
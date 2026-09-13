import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as https from "https";
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

const identity = `brain-${Math.random().toString(36).slice(2, 9)}`;
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
      body: { name: `Brain Tester`, email: `${identity}@test.dev`, password },
    });
    ok(reg.status === 200, `register → ${reg.status}`);
    token = reg.json?.token;
    cookie = (reg.headers?.["set-cookie"]?.[0] || "").split(";")[0];
    const auth = { Authorization: `Bearer ${token}`, Cookie: cookie };

    // 2. Create a BUSINESS workspace + seed demo data (real DB writes)
    const comp = await request("/api/companies", {
      method: "POST",
      headers: auth,
      body: { name: `Brain Workspace ${identity}`, industry: "Technology", profileType: "BUSINESS" },
    });
    ok(comp.status === 201, `create workspace → ${comp.status}`);
    companyId = comp.json?.company?.id;
    ok(!!companyId, "company id returned");

    const seed = await request(`/api/companies/${companyId}/seed`, { method: "POST", headers: auth });
    ok(seed.status === 200 && seed.json?.seeded === true, `seed → ${seed.json?.seeded}`);

    // 3. Adaptive Brain — ingest learning events through the public events API
    const ev1 = await request(`/api/companies/${companyId}/brain/events`, {
      method: "POST",
      headers: auth,
      body: { eventType: "content_published", payload: { platform: "linkedin", contentType: "CAROUSEL", hour: 12, day: "Tue" }, dedupeKey: "pub-1" },
    });
    ok(ev1.status === 201 && ev1.json?.ingested === true, `content_published ingested → ${ev1.status}`);

    const evDup = await request(`/api/companies/${companyId}/brain/events`, {
      method: "POST",
      headers: auth,
      body: { eventType: "content_published", payload: { platform: "linkedin", contentType: "CAROUSEL", hour: 12 }, dedupeKey: "pub-1" },
    });
    ok(evDup.json?.ingested === false, `dedupe suppresses repeat event`);

    const perf = await request(`/api/companies/${companyId}/brain/events`, {
      method: "POST",
      headers: auth,
      body: { eventType: "content_performance", payload: { topic: "AI workflows", platform: "linkedin", contentType: "CAROUSEL", metric: "reach", value: 3200 } },
    });
    ok(perf.status === 201 && perf.json?.ingested === true, `content_performance ingested → ${perf.status}`);

    const feedback = await request(`/api/companies/${companyId}/brain/events`, {
      method: "POST",
      headers: auth,
      body: { eventType: "user_feedback", payload: { rating: 5, note: "client loves AI workflows posts" } },
    });
    ok(feedback.status === 201, `user_feedback ingested → ${feedback.status}`);

    // Learning rows landed in DB
    const learningRows = await prisma.learningEvent.count({ where: { companyId } });
    ok(learningRows >= 3, `learning events in DB = ${learningRows}`);
    const insightRows = await prisma.brainInsight.count({ where: { companyId } });
    ok(insightRows >= 3, `insights created = ${insightRows}`);

    // 4. Learning read API — reconcile + insights + next actions + summary
    const learn1 = await request(`/api/companies/${companyId}/brain/learn`, { headers: auth });
    ok(learn1.status === 200, `brain/learn GET → ${learn1.status}`);
    ok(Array.isArray(learn1.json?.insights) && learn1.json.insights.length >= 1, `insights = ${learn1.json?.insights?.length}`);
    ok(typeof learn1.json?.reconciled === "number", `reconcile flag (count) = ${learn1.json?.reconciled}`);
    ok(Array.isArray(learn1.json?.counts) && learn1.json.counts.length > 0, `status counts = ${learn1.json?.counts?.length}`);
    ok(Array.isArray(learn1.json?.summary) && learn1.json.summary.length >= 0, `learning summary = ${learn1.json?.summary?.length} lines`);

    const firstInsight = learn1.json?.insights?.[0];
    ok(firstInsight && typeof firstInsight.confidence === "number", "insight has confidence score");
    ok(firstInsight && firstInsight.type && firstInsight.status, "insight has type + status");

    // 5. Feedback loop — verify on an insight
    if (firstInsight) {
      const fb = await request(`/api/companies/${companyId}/brain/learn`, {
        method: "POST",
        headers: auth,
        body: { insightId: firstInsight.id, action: "verify" },
      });
      ok(fb.status === 200 && fb.json?.result?.id === firstInsight.id, `insight verify → ${fb.status}`);
      const afterFeedback = await prisma.brainInsight.findUnique({ where: { id: firstInsight.id } });
      ok(afterFeedback && afterFeedback.status === "VALIDATED", `verified insight status = ${afterFeedback?.status}`);
    }

    // 6. Competitor War Room — add tracked competitors then build the report
    const c1 = await request(`/api/companies/${companyId}/competitors`, {
      method: "POST",
      headers: auth,
      body: { name: "RivalAI", platform: "linkedin", website: "https://rival.example", notes: "They dominate the AI workflows topic on LinkedIn" },
    });
    ok(c1.status === 201, `competitor 1 → ${c1.status}`);
    const c2 = await request(`/api/companies/${companyId}/competitors`, {
      method: "POST",
      headers: auth,
      body: { name: "CreatorHQ", platform: "instagram", notes: "Reels with 2-sec hooks are their strength" },
    });
    ok(c2.status === 201, `competitor 2 → ${c2.status}`);

    const war = await request(`/api/companies/${companyId}/competitors/war-room`, { headers: auth });
    ok(war.status === 200, `war-room → ${war.status}`);
    ok(Array.isArray(war.json?.competitors) && war.json.competitors.length >= 2, `analyzed competitors = ${war.json?.competitors?.length}`);
    ok(typeof war.json?.avgThreat === "number", "avg threat score present");
    const first = war.json?.competitors?.[0];
    ok(first && typeof first.threatScore === "number" && first.threatScore >= 6, `threat score = ${first?.threatScore}`);
    ok(first && Array.isArray(first.gaps) && Array.isArray(first.counterStrategies), "gaps + counter-strategies present");
    ok(first && Array.isArray(first.battlecard) && first.battlecard.length > 0, `battlecard = ${first?.battlecard?.length}`);
    ok(first && typeof first.whyWinning === "string" && first.whyWinningProvider, "why-winning narrative + provider attribution");

    // 7. Social Inbox — message lifecycle with sentiment + AI suggestion
    const imsg = await request(`/api/companies/${companyId}/inbox`, {
      method: "POST",
      headers: auth,
      body: { platform: "linkedin", channelType: "comment", content: "Great post! How do I get early access to the AI workflows beta?", authorHandle: "@devjane" },
    });
    ok(imsg.status === 201, `inbox create → ${imsg.status}`);
    const inboxId = imsg.json?.message?.id;
    ok(!!inboxId, "inbox message id returned");
    ok(imsg.json?.message?.sentiment && imsg.json?.message?.intent, `sentiment=${imsg.json?.message?.sentiment} intent=${imsg.json?.message?.intent}`);
    const row = await prisma.inboxMessage.findUnique({ where: { id: inboxId } });
    ok(row && row.status === "unread", "inbox message persisted as unread in DB");

    const inboxList = await request(`/api/companies/${companyId}/inbox`, { headers: auth });
    ok(inboxList.status === 200 && inboxList.json?.messages?.length >= 1, `inbox list → ${inboxList.status}`);

    const sugg = await request(`/api/companies/${companyId}/inbox/${inboxId}`, { method: "POST", headers: auth });
    ok(sugg.status === 200 && typeof sugg.json?.suggestion === "string" && sugg.json.suggestion.length > 5, `reply suggestion = "${sugg.json?.suggestion?.slice(0, 40)}…"`);
    ok(sugg.json?.tone === "ai" || sugg.json?.tone === "template", `suggestion tone = ${sugg.json?.tone}`);

    const reply = await request(`/api/companies/${companyId}/inbox/${inboxId}`, {
      method: "PATCH",
      headers: auth,
      body: { replyText: "Thanks for the kind words! Early access opens this week — want an invite?" },
    });
    ok(reply.status === 200 && reply.json?.message?.status === "replied", `mark replied → ${reply.json?.message?.status}`);

    const delIm = await request(`/api/companies/${companyId}/inbox/${inboxId}`, { method: "DELETE", headers: auth });
    ok(delIm.status === 200 && delIm.json?.ok === true, "inbox delete works");

    // 8. Media library — CRUD by URL (honest metadata, no faked files)
    const asset = await request(`/api/companies/${companyId}/media`, {
      method: "POST",
      headers: auth,
      body: { originalName: "launch-banner.png", mimeType: "image/png", url: "https://cdn.example/launch-banner.png", type: "image" },
    });
    ok(asset.status === 201, `media create → ${asset.status}`);
    const assetId = asset.json?.asset?.id;
    ok(!!assetId, "media asset id returned");
    const mediaBad = await request(`/api/companies/${companyId}/media`, { method: "POST", headers: auth, body: {} });
    ok(mediaBad.status === 400, `media without url → ${mediaBad.status}`);
    const mediaList = await request(`/api/companies/${companyId}/media`, { headers: auth });
    ok(mediaList.status === 200 && mediaList.json?.assets?.length >= 1, `media list → ${mediaList.json?.assets?.length} assets`);
    const mediaDel = await request(`/api/companies/${companyId}/media/${assetId}`, { method: "DELETE", headers: auth });
    ok(mediaDel.status === 200, "media delete works");

    // 9. The three previously-404 pages now render
    for (const page of ["inbox", "agents", "media"]) {
      const html = await request(`/dashboard/${page}`, { headers: { Cookie: cookie } });
      ok(html.status === 200, `/dashboard/${page} → ${html.status}`);
    }

    // 10. Tenant isolation — non-member gets 403 on the new endpoints
    const foreignToken = await sign({ userId: "2033d739-0000-4a78-a4c0-rigged", email: "rigged@test.dev" });
    const foreign = await request(`/api/companies/${companyId}/competitors/war-room`, { headers: { Authorization: `Bearer ${foreignToken}` } });
    ok(foreign.status === 403, `non-member war-room → ${foreign.status}`);

    // Clean up: delete company (cascade removes children), keep DB clean
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.user.deleteMany({ where: { email: `${identity}@test.dev` } });

    const [users, companies, leaks] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.learningEvent.count({ where: { companyId } }),
    ]);
    ok(users === 1 && companies === 1, `cleanup → users=${users} companies=${companies}`);
    ok(leaks === 0, "no orphaned learning events after cleanup");
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
#!/usr/bin/env node
// Cron/worker entry: drains the generation job queue via the internal endpoint.
// Usage:
//   npm run worker                    # one pass
//   npm run worker -- --loop 60       # run every 60s
import * as fs from "fs";

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

import * as jose from "jose";
import { PrismaClient } from "@prisma/client";

const PORT = process.env.WORKER_PORT || 8080;
const BASE = `http://localhost:${PORT}`;
const prisma = new PrismaClient();

async function main() {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-jwt-secret-change-in-production-32chars-min");
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error("no users — cannot authenticate worker");
    process.exit(1);
  }
  const token = await new jose.SignJWT({ userId: user.id, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(secret);

  const res = await fetch(`${BASE}/api/jobs/process?batch=5`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  console.log(`[worker] ${res.status}`, json);
  await prisma.$disconnect();
}

const args = process.argv.slice(2);
const loopIndex = args.indexOf("--loop");
const loopSeconds = loopIndex >= 0 ? parseInt(args[loopIndex + 1], 10) : 0;

async function run() {
  try {
    await main();
  } catch (e) {
    console.error("[worker] error", e);
    process.exitCode = 1;
  }
}

if (!loopSeconds) {
  await run();
} else {
  console.log(`[worker] looping every ${loopSeconds}s`);
  await run();
  setInterval(run, loopSeconds * 1000);
}
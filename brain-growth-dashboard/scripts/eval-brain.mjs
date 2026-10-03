/**
 * Brain eval — memory flywheel numbers from the real database. No mocks.
 *
 * Metrics (all computed from actual rows in the configured Postgres database):
 *  - insightPrecision: share of decided insights that users/system validated
 *  - calibration: verify-rate per confidence decile (do higher-confidence
 *    insights actually validate more often?)
 *  - promotePrecision: share of promoted LEARNED_* memories still VERIFIED
 *  - approvalCoverage: share of decided approvals that produced a decision memory
 *
 * Usage: node scripts/eval-brain.mjs  (prints JSON)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DECIDED = ["VALIDATED", "ACTIVE", "REJECTED", "SUPERSEDED", "STALE"];
const GOOD = ["VALIDATED", "ACTIVE"];

async function main() {
  const insights = await prisma.brainInsight.findMany({
    select: { status: true, confidence: true, type: true },
  });
  const decided = insights.filter((i) => DECIDED.includes(i.status));
  const good = decided.filter((i) => GOOD.includes(i.status));
  const insightPrecision = decided.length ? good.length / decided.length : null;

  const buckets = [];
  for (let d = 0; d < 10; d++) {
    const lo = d / 10;
    const hi = (d + 1) / 10;
    const inBucket = decided.filter((i) => i.confidence >= lo && (d === 9 ? i.confidence <= hi : i.confidence < hi));
    if (inBucket.length === 0) continue;
    const verified = inBucket.filter((i) => GOOD.includes(i.status)).length;
    buckets.push({ decile: `${lo.toFixed(1)}-${hi.toFixed(1)}`, n: inBucket.length, verifyRate: verified / inBucket.length });
  }

  const learned = await prisma.memory.findMany({
    where: { type: { startsWith: "LEARNED_" } },
    select: { verificationStatus: true },
  });
  const learnedGood = learned.filter((m) => m.verificationStatus === "VERIFIED").length;
  const promotePrecision = learned.length ? learnedGood / learned.length : null;

  const approvals = await prisma.approval.findMany({ select: { id: true, status: true } });
  const decidedApprovals = approvals.filter((a) => ["APPROVED", "REJECTED"].includes(a.status));
  let withMemory = 0;
  for (const a of decidedApprovals) {
    const mem = await prisma.memory.findFirst({
      where: { source: { contains: a.id } },
      select: { id: true },
    });
    if (mem) withMemory++;
  }
  const approvalCoverage = decidedApprovals.length ? withMemory / decidedApprovals.length : null;

  const out = {
    generatedAt: new Date().toISOString(),
    insights: { total: insights.length, decided: decided.length, validated: good.length, insightPrecision },
    calibration: buckets,
    promotedMemories: { total: learned.length, verified: learnedGood, promotePrecision },
    approvals: { decided: decidedApprovals.length, withDecisionMemory: withMemory, approvalCoverage },
  };
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("eval-brain failed:", e?.message || e);
  await prisma.$disconnect();
  process.exit(1);
});

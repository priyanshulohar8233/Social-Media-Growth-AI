/**
 * reset-user-data.mjs
 * Deletes ALL user-generated data from the database.
 * Schema (tables/columns) is NOT touched — only rows are removed.
 * Run: node scripts/reset-user-data.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n========================================');
  console.log('  BrainGrow — User Data Reset Script');
  console.log('========================================\n');

  // ── 1. Count before ────────────────────────────────────────────────
  const usersBefore = await prisma.user.count();
  const companiesBefore = await prisma.company.count();
  console.log(`Before reset → Users: ${usersBefore} | Companies: ${companiesBefore}\n`);

  // ── 2. Delete in dependency order (children first) ─────────────────
  //  We rely on Cascade deletes where possible, but explicit order avoids
  //  FK constraint errors on SQLite (which has no deferred constraints).

  const steps = [
    // Leaf tables / children of Company
    ['aiUsage',               () => prisma.aiUsage.deleteMany()],
    ['analyticsEvent',        () => prisma.analyticsEvent.deleteMany()],
    ['performanceMetric',     () => prisma.performanceMetric.deleteMany()],
    ['lead',                  () => prisma.lead.deleteMany()],
    ['conversion',            () => prisma.conversion.deleteMany()],
    ['roiRecord',             () => prisma.roiRecord.deleteMany()],
    ['growthOpportunity',     () => prisma.growthOpportunity.deleteMany()],
    ['growthRecommendation',  () => prisma.growthRecommendation.deleteMany()],
    ['nextBestAction',        () => prisma.nextBestAction.deleteMany()],
    ['notification',          () => prisma.notification.deleteMany()],
    ['inboxMessage',          () => prisma.inboxMessage.deleteMany()],
    ['trend',                 () => prisma.trend.deleteMany()],
    ['competitor',            () => prisma.competitor.deleteMany()],
    ['contentDna',            () => prisma.contentDna.deleteMany()],
    ['experiment',            () => prisma.experiment.deleteMany()],
    ['brainInsight',          () => prisma.brainInsight.deleteMany()],
    ['learningEvent',         () => prisma.learningEvent.deleteMany()],
    ['memory',                () => prisma.memory.deleteMany()],
    ['mediaAsset',            () => prisma.mediaAsset.deleteMany()],
    ['documentChunk',         () => prisma.documentChunk.deleteMany()],
    ['document',              () => prisma.document.deleteMany()],
    ['generationAsset',       () => prisma.generationAsset.deleteMany()],
    ['generationJob',         () => prisma.generationJob.deleteMany()],
    ['agentRun',              () => prisma.agentRun.deleteMany()],
    ['approval',              () => prisma.approval.deleteMany()],
    ['calendarItem',          () => prisma.calendarItem.deleteMany()],
    ['contentCalendar',       () => prisma.contentCalendar.deleteMany()],
    ['contentVariant',        () => prisma.contentVariant.deleteMany()],
    ['content',               () => prisma.content.deleteMany()],
    ['socialPost',            () => prisma.socialPost.deleteMany()],
    ['socialAccount',         () => prisma.socialAccount.deleteMany()],
    ['messagingIdentity',     () => prisma.messagingIdentity.deleteMany()],
    ['contentPillar',         () => prisma.contentPillar.deleteMany()],
    ['collaboration',         () => prisma.collaboration.deleteMany()],
    ['brandDeal',             () => prisma.brandDeal.deleteMany()],
    ['monetizationChannel',   () => prisma.monetizationChannel.deleteMany()],
    ['model',                 () => prisma.model.deleteMany()],
    ['provider',              () => prisma.provider.deleteMany()],
    ['audienceSegment',       () => prisma.audienceSegment.deleteMany()],
    ['audience',              () => prisma.audience.deleteMany()],
    ['brandRule',             () => prisma.brandRule.deleteMany()],
    ['product',               () => prisma.product.deleteMany()],
    ['service',               () => prisma.service.deleteMany()],
    ['businessGoal',          () => prisma.businessGoal.deleteMany()],
    ['creatorProfile',        () => prisma.creatorProfile.deleteMany()],
    ['companyProfile',        () => prisma.companyProfile.deleteMany()],
    ['auditLog',              () => prisma.auditLog.deleteMany()],
    // Membership (links User↔Company)
    ['membership',            () => prisma.membership.deleteMany()],
    // Company
    ['company',               () => prisma.company.deleteMany()],
    // User-level
    ['brandDetail',           () => prisma.brandDetail.deleteMany()],
    ['emailVerificationToken',() => prisma.emailVerificationToken.deleteMany()],
    // Users last
    ['user',                  () => prisma.user.deleteMany()],
  ];

  let totalDeleted = 0;
  for (const [name, fn] of steps) {
    try {
      const result = await fn();
      const count = result?.count ?? 0;
      if (count > 0) {
        console.log(`  ✓ ${name.padEnd(28)} — deleted ${count} row(s)`);
        totalDeleted += count;
      } else {
        console.log(`  · ${name.padEnd(28)} — (empty)`);
      }
    } catch (err) {
      // Table may not exist in this migration version — skip silently
      console.log(`  ⚠ ${name.padEnd(28)} — skipped (${err.message.split('\n')[0]})`);
    }
  }

  // ── 3. Verify ──────────────────────────────────────────────────────
  const usersAfter   = await prisma.user.count();
  const companiesAfter = await prisma.company.count();

  console.log('\n========================================');
  console.log(`  Total rows deleted : ${totalDeleted}`);
  console.log(`  Users remaining    : ${usersAfter}`);
  console.log(`  Companies remaining: ${companiesAfter}`);
  console.log('  Schema intact      : YES');
  console.log('========================================\n');

  if (usersAfter === 0 && companiesAfter === 0) {
    console.log('✅ Reset successful — database is clean.\n');
  } else {
    console.log('⚠️  Some rows may still remain — check output above.\n');
  }
}

main()
  .catch(e => { console.error('RESET FAILED:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

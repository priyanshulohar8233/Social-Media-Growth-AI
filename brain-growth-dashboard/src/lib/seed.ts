import { prisma } from "@/lib/db";

/**
 * Demo data generator for a fresh workspace.
 * Creates a realistic, company-scoped dataset so every dashboard screen
 * renders real DB rows (not hardcoded UI). Idempotent — if the company
 * already has analytics data it returns early unless `force` is set.
 */

const PLATFORMS = ["instagram", "youtube", "linkedin", "facebook", "twitter", "tiktok"] as const;

const PLATFORM_HANDLES: Record<string, string> = {
  instagram: "@braingrow_hq",
  youtube: "BrainGrow HQ",
  linkedin: "BrainGrow Inc.",
  facebook: "BrainGrow",
  twitter: "@braingrow",
  tiktok: "@braingrow",
};

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function rounded(value: number, decimals = 1): number {
  return Number(value.toFixed(decimals));
}

export async function seedCompanyDemoData(companyId: string, force = false) {
  const existing = await prisma.analyticsEvent.count({ where: { companyId } });
  if (existing > 0 && !force) return { seeded: false, reason: "already-seeded" };

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { creatorProfile: true, profile: true },
  });
  if (!company) return { seeded: false, reason: "not-found" };

  if (force) {
    await prisma.$transaction([
      prisma.analyticsEvent.deleteMany({ where: { companyId } }),
      prisma.performanceMetric.deleteMany({ where: { companyId } }),
      prisma.socialPost.deleteMany({ where: { companyId } }),
      prisma.content.deleteMany({ where: { companyId } }),
      prisma.calendarItem.deleteMany({ where: { companyId } }),
      prisma.contentCalendar.deleteMany({ where: { companyId } }),
      prisma.growthOpportunity.deleteMany({ where: { companyId } }),
      prisma.growthRecommendation.deleteMany({ where: { companyId } }),
      prisma.nextBestAction.deleteMany({ where: { companyId } }),
      prisma.audience.deleteMany({ where: { companyId } }),
      prisma.audienceSegment.deleteMany({ where: { companyId } }),
      prisma.socialAccount.deleteMany({ where: { companyId } }),
      prisma.lead.deleteMany({ where: { companyId } }),
      prisma.conversion.deleteMany({ where: { companyId } }),
      prisma.roiRecord.deleteMany({ where: { companyId } }),
      prisma.memory.deleteMany({ where: { companyId } }),
      prisma.trend.deleteMany({ where: { companyId } }),
    ]);
  }

  const brandSeed = hashSeed(company.name || companyId);
  const niche =
    company.creatorProfile?.contentNiche ||
    company.creatorProfile?.creatorNiche ||
    company.industry ||
    "Social Media";

  // Social accounts
  const socialAccounts = await Promise.all(
    PLATFORMS.map((platform, i) =>
      prisma.socialAccount.create({
        data: {
          companyId,
          platform,
          handle: PLATFORM_HANDLES[platform],
          displayName: PLATFORM_HANDLES[platform],
          status: "connected",
          meta: JSON.stringify({ followers: 5000 + ((brandSeed + i * 7000) % 120000) }),
        },
      })
    )
  );

  // Content posts across the last ~60 days
  const hookBank = [
    `3 ${niche} mistakes you're still making`,
    `The fastest way to grow on ${niche}`,
    `Behind-the-scenes: a day at ${company.name}`,
    `We tested 7 ${niche} strategies so you don't have to`,
    `How ${company.name} thinks about ${niche}`,
    `5 tools every ${niche} creator should use`,
    `Why your ${niche} content isn't reaching anyone`,
    `${niche}: what's changed in the last 6 months`,
  ];
  const ctaBank = ["Comment below", "Save this for later", "Share with a friend", "Link in bio", "Follow for more"];

  const contents: Array<{ id: string; platform: string }> = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const platform = PLATFORMS[i % PLATFORMS.length];
    const publishedOffset = 60 - i * 4; // newer posts earlier in list
    const publishedAt = new Date(now.getTime() - publishedOffset * 86400000);
    const hSeed = brandSeed + i * 101;
    const status = i < 11 ? "PUBLISHED" : i < 13 ? "SCHEDULED" : "DRAFT";
    const content = await prisma.content.create({
      data: {
        companyId,
        title: pick(hookBank, hSeed),
        hook: pick(hookBank, hSeed),
        cta: pick(ctaBank, hSeed),
        hashtags: JSON.stringify([`#${niche.replace(/\s+/g, "")}`, `#${platform}`, "#braingrow"]),
        platform,
        contentType: pick(["POST", "REEL", "CAROUSEL", "VIDEO", "THREAD"], hSeed + 3),
        status,
        scheduledAt: status === "SCHEDULED" ? new Date(now.getTime() + (i - 11) * 86400000) : null,
        publishedAt: status === "PUBLISHED" ? publishedAt : null,
        authorId: null,
      },
    });
    contents.push({ id: content.id, platform });

    // Per-post performance metrics
    const baseReach = 4000 + (hSeed % 150000);
    await prisma.performanceMetric.createMany({
      data: [
        { companyId, contentId: content.id, platform, metric: "reach", value: baseReach, period: "30d" },
        { companyId, contentId: content.id, platform, metric: "impressions", value: rounded(baseReach * 1.35, 0), period: "30d" },
        { companyId, contentId: content.id, platform, metric: "engagement", value: rounded(baseReach * (0.04 + ((hSeed % 40) / 1000)), 0), period: "30d" },
        { companyId, contentId: content.id, platform, metric: "engagement_rate", value: rounded(4 + ((hSeed % 60) / 10), 2), period: "30d" },
      ],
    });
  }

  // Analytics events over the last 30 days for the time series
  const eventTypes: Array<{ type: string; weight: number }> = [
    { type: "view", weight: 62 },
    { type: "like", weight: 14 },
    { type: "share", weight: 7 },
    { type: "comment", weight: 5 },
    { type: "click", weight: 12 },
  ];
  const events: Array<{ companyId: string; platform: string; eventType: string; value: number; createdAt: Date; contentId: string | null }> = [];
  for (let day = 29; day >= 0; day--) {
    const date = new Date(now.getTime() - day * 86400000);
    for (const platform of PLATFORMS) {
      let pack = brandSeed + day * 7 + hashSeed(platform);
      for (const et of eventTypes) {
        const count = 2 + ((pack % 60) * et.weight) / 100;
        pack = (pack * 17 + 11) | 0;
        // spread events through the day
        for (let k = 0; k < count; k++) {
          const ts = new Date(date);
          ts.setHours((hashSeed(`${platform}${day}${et.type}${k}`) % 24), (hashSeed(`${platform}${day}${k}`) % 60));
          events.push({
            companyId,
            platform,
            eventType: et.type,
            value: et.type === "view" ? 50 + (hashSeed(`${platform}${day}${et.type}${k}`) % 900) : 1 + (hashSeed(`${platform}${et.type}${k}`) % 12),
            createdAt: ts,
            contentId: contents.length ? contents[day % contents.length].id : null,
          });
        }
      }
    }
  }

  // Batch insert in chunks
  const BATCH = 400;
  for (let i = 0; i < events.length; i += BATCH) {
    await prisma.analyticsEvent.createMany({ data: events.slice(i, i + BATCH) });
  }

  // Social posts = the published contents with metrics JSON
  await Promise.all(
    contents.slice(0, 11).map(async (c, i) => {
      const platform = c.platform;
      const s = socialAccounts.find((a) => a.platform === platform);
      return prisma.socialPost.create({
        data: {
          companyId,
          accountId: s?.id || null,
          platform,
          contentId: c.id,
          caption: pick(hookBank, brandSeed + i * 13),
          status: "published",
          publishedAt: new Date(now.getTime() - (60 - i * 4) * 86400000),
          metrics: JSON.stringify({
            likes: 300 + ((brandSeed + i * 900) % 8000),
            comments: 20 + ((brandSeed + i * 180) % 700),
            shares: 10 + ((brandSeed + i * 120) % 500),
            reach: 4000 + ((brandSeed + i * 7000) % 150000),
            saveCount: 15 + ((brandSeed + i * 220) % 900),
          }),
        },
      });
    })
  );

  // Content calendar for the current month
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const calendar = await prisma.contentCalendar.upsert({
    where: { companyId_month_year: { companyId, month, year } },
    update: {},
    create: { companyId, month, year, name: `${year}-${month}` },
  });
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(9, 0, 0, 0);
  const calendarItems = await Promise.all(
    Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const platform = PLATFORMS[((brandSeed + i) % PLATFORMS.length)];
      return prisma.calendarItem.create({
        data: {
          companyId,
          calendarId: calendar.id,
          date,
          platform,
          status: i < 2 ? "PUBLISHED" : i < 5 ? "SCHEDULED" : "DRAFT",
          title: pick(hookBank, brandSeed + i * 31),
        },
      });
    })
  );
  void calendarItems;

  // Audience
  const totalAudience = 18000 + (brandSeed % 90000);
  const ageGroups = [
    { name: "18-24", min: 22, max: 38 },
    { name: "25-34", min: 28, max: 44 },
    { name: "35-44", min: 15, max: 28 },
    { name: "45-54", min: 8, max: 18 },
    { name: "55+", min: 4, max: 12 },
  ];
  const ageData = ageGroups.map((g, i) => ({
    name: g.name,
    value: rounded(g.min + ((brandSeed >> i) % (g.max - g.min))),
  }));
  // normalize to 100
  const ageSum = ageData.reduce((s, a) => s + a.value, 0);
  ageData.forEach((a) => (a.value = rounded((a.value / ageSum) * 100)));

  await prisma.audience.create({
    data: {
      companyId,
      name: "Primary audience",
      description: `Core ${niche} audience for ${company.name}`,
      demographics: JSON.stringify({ age: ageData, gender: [{ name: "Female", value: 52 }, { name: "Male", value: 46 }, { name: "Other", value: 2 }] }),
    },
  });

  await prisma.audienceSegment.createMany({
    data: [
      { companyId, name: "Price-sensitive", description: "Trial customers, discounts", criteria: JSON.stringify({ value: "deal-driven" }) },
      { companyId, name: "Premium", description: "High LTV, brand loyalists", criteria: JSON.stringify({ value: "premium" }) },
      { companyId, name: "Researchers", description: "Compare before buying", criteria: JSON.stringify({ value: "research" }) },
    ],
  });

  // Growth + intelligence
  await prisma.growthOpportunity.createMany({
    data: [
      { companyId, title: "Post more Reels", description: "Reels get 2.8x more engagement than static posts.", type: "CONTENT", impact: "high", confidence: 0.92, status: "open" },
      { companyId, title: "Best time to post", description: "Audience is most active Tue–Thu 11am–1pm & 7–9pm.", type: "TIMING", impact: "high", confidence: 0.89, status: "open" },
      { companyId, title: "Educational content gap", description: "Competitors post 40% more educational content.", type: "CONTENT", impact: "medium", confidence: 0.85, status: "open" },
    ],
  });

  await prisma.growthRecommendation.createMany({
    data: [
      { companyId, title: "Post more Reels", description: "Reels get 2.8x more engagement than static posts.", expectedImpact: "+35% reach", confidence: 0.92, status: "pending" },
      { companyId, title: "Optimize posting times", description: "Post during Tue–Thu 11am–1pm & 7–9pm.", expectedImpact: "+28% engagement", confidence: 0.89, status: "pending" },
      { companyId, title: "Collaborate with micro-influencers", description: "Partnerships can boost reach up to 40%.", expectedImpact: "+40% reach", confidence: 0.78, status: "pending" },
    ],
  });

  await prisma.nextBestAction.createMany({
    data: [
      { companyId, title: "Create 2 Reels this week", description: "Reels are your highest-ROI format right now.", reasoning: "Reels drive 2.8x engagement", expectedImpact: "+35% reach", confidence: 0.9, status: "pending" },
      { companyId, title: "Schedule for peak window", description: "Publish Tue at 11am to hit active audiences.", reasoning: "Peak activity window identified", expectedImpact: "+28% engagement", confidence: 0.87, status: "pending" },
      { companyId, title: "Reply to comments in DMs", description: "Engage with top commenters to build community.", reasoning: "Community engagement boosts algorithm", expectedImpact: "+15% retention", confidence: 0.82, status: "pending" },
    ],
  });

  // Leads + conversions + ROI
  const leads = await prisma.lead.createMany({
    data: Array.from({ length: 18 }, (_, i) => ({
      companyId,
      source: pick(["post", "website", "ad", "referral"], brandSeed + i * 7),
      email: `lead${i + 1}@example.com`,
      name: `Lead ${i + 1}`,
      status: i % 5 === 0 ? "converted" : "new",
      createdAt: new Date(now.getTime() - i * 1.6 * 86400000),
    })),
  });
  void leads;

  await prisma.conversion.createMany({
    data: Array.from({ length: 6 }, (_, i) => ({
      companyId,
      value: 8000 + (brandSeed % 40000) + i * 2500,
      currency: "INR",
      createdAt: new Date(now.getTime() - i * 4 * 86400000),
    })),
  });

  await prisma.roiRecord.createMany({
    data: Array.from({ length: 5 }, (_, i) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const spend = 15000 + (brandSeed % 20000);
      const revenue = spend * (1.6 + ((brandSeed >> i) % 15) / 10);
      return {
        companyId,
        period: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`,
        spend,
        revenue: rounded(revenue, 0),
        roi: rounded((revenue - spend) / spend, 2),
      };
    }),
  });

  // Verified memories (company brain facts)
  await prisma.memory.createMany({
    data: [
      { companyId, type: "BRAND_RULE", content: `Core niche is ${niche}`, verificationStatus: "VERIFIED", confidence: 0.98 },
      { companyId, type: "VERIFIED_FACT", content: `${company.name} posts 4-5 times per week across ${PLATFORMS.length} platforms`, verificationStatus: "VERIFIED", confidence: 0.95 },
      { companyId, type: "VERIFIED_FACT", content: "Reels outperform static posts by 2.8x on average", verificationStatus: "VERIFIED", confidence: 0.9 },
      { companyId, type: "AUDIENCE_INSIGHT", content: "Primary audience skews 18-34 with strongest activity Tue-Thu evenings", verificationStatus: "VERIFIED", confidence: 0.88 },
      { companyId, type: "PERFORMANCE", content: "Best posting window is 11am-1pm and 7-9pm", verificationStatus: "VERIFIED", confidence: 0.86 },
    ],
  });

  // Trends
  await prisma.trend.createMany({
    data: [
      { companyId, title: "Short-form video dominates", description: "Reels/TikTok continue to drive highest reach.", lifecycle: "rising", relevance: "high", recommendation: "USE_NOW", confidence: 0.9 },
      { companyId, title: "AI-assisted content creation", description: "Adoption of AI tools in content pipelines is accelerating.", lifecycle: "emerging", relevance: "medium", recommendation: "WATCH", confidence: 0.82 },
      { companyId, title: "Authentic behind-the-scenes", description: "Audiences respond to transparency and real workflows.", lifecycle: "rising", relevance: "high", recommendation: "USE_NOW", confidence: 0.85 },
    ],
  });

  return { seeded: true, counts: { contents: contents.length, events: events.length, platforms: PLATFORMS.length } };
}
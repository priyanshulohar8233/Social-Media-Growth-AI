import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address").optional(),
});

export const socialManualConnectSchema = z
  .object({
    platform: z.string().trim().min(1, "Platform is required").max(50),
    action: z.enum(["connect", "disconnect"]),
    handle: z.string().trim().min(1, "Handle is required to link an account").max(100).optional(),
    displayName: z.string().trim().max(100).optional().or(z.literal("")),
    accessToken: z.string().max(2000).optional().or(z.literal("")),
    refreshToken: z.string().max(2000).optional().or(z.literal("")),
    scopes: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine(
    (d) => d.action === "disconnect" || (d.handle !== undefined && d.handle.trim().length > 0),
    {
      message: "Handle is required to link an account",
      path: ["handle"],
    }
  );

export const brandDetailsSchema = z
  .object({
    businessType: z.enum(["Individual", "Company"], {
      message: "Business Type must be either Individual or Company",
    }),
    industry: z.string().trim().max(100).optional().or(z.literal("")),
    contentType: z.string().trim().min(1, "Content Type is required").max(100),
    goal: z.string().trim().min(1, "Primary Goal is required").max(100),
    website: z
      .string()
      .trim()
      .url("Please enter a valid URL (e.g. https://example.com)")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.businessType === "Company") {
        return Boolean(data.industry && data.industry.trim().length > 0);
      }
      return true;
    },
    {
      message: "Industry is required when Business Type is Company",
      path: ["industry"],
    }
  );

export const createCompanySchema = z.object({
  name: z.string().min(2).max(100),
  industry: z.string().max(100).optional(),
  website: z.string().url().optional().or(z.literal("")),
  description: z.string().max(2000).optional(),
  profileType: z.enum(["BUSINESS", "CREATOR", "PERSONAL_BRAND", "AGENCY"]).optional(),
  // creator-specific
  creatorNiche: z.string().max(100).optional(),
  contentNiche: z.string().max(100).optional(),
  creatorGoals: z.string().max(5000).optional(),
});

export const updateCreatorProfileSchema = z.object({
  creatorNiche: z.string().max(100).optional(),
  contentNiche: z.string().max(100).optional(),
  personalBrand: z.string().max(5000).optional(),
  contentPillars: z.string().max(5000).optional(),
  creatorVoice: z.string().max(5000).optional(),
  personality: z.string().max(5000).optional(),
  speakingStyle: z.string().max(5000).optional(),
  visualStyle: z.string().max(5000).optional(),
  audience: z.string().max(5000).optional(),
  creatorGoals: z.string().max(5000).optional(),
  monetization: z.string().max(5000).optional(),
});

export const updateCompanyProfileSchema = z.object({
  businessGoals: z.string().max(5000).optional(),
  targetAudience: z.string().max(5000).optional(),
  productsServices: z.string().max(5000).optional(),
  brandVoice: z.string().max(5000).optional(),
  brandRestrictions: z.string().max(5000).optional(),
  contentPreferences: z.string().max(5000).optional(),
  location: z.string().max(200).optional(),
});

export const createMemorySchema = z.object({
  type: z.enum([
    "VERIFIED_FACT",
    "BUSINESS_CONTEXT",
    "BRAND_RULE",
    "APPROVED_REFERENCE",
    "CONTENT_HISTORY",
    "CONTENT_DNA",
    "PERFORMANCE_LEARNING",
    "DECISION_HISTORY",
    "TREND_OBSERVATION",
    "COMPETITOR_OBSERVATION",
    "AUDIENCE_OBSERVATION",
    "GROWTH_LEARNING",
    "STRATEGY_LEARNING",
    "SOURCE_PROVENANCE",
  ]),
  content: z.string().min(1).max(10000),
  source: z.string().max(1000).optional(),
  provenance: z.string().max(5000).optional(),
  confidence: z.number().min(0).max(1).optional(),
  verificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED", "EXPIRED"]).optional(),
  expiresAt: z.string().datetime().optional().or(z.literal("")),
});

export const createContentSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(10000).optional(),
  hook: z.string().max(500).optional(),
  cta: z.string().max(500).optional(),
  hashtags: z.array(z.string()).optional(),
  platform: z
    .enum(["instagram", "tiktok", "youtube", "linkedin", "twitter", "facebook", "other", "INSTAGRAM", "TIKTOK", "YOUTUBE", "LINKEDIN", "TWITTER", "FACEBOOK", "OTHER"])
    .transform((v) => v.toLowerCase()),
  contentType: z
    .enum(["post", "reel", "carousel", "story", "video", "thread", "article", "short", "POST", "REEL", "CAROUSEL", "STORY", "VIDEO", "THREAD", "ARTICLE", "SHORT"])
    .transform((v) => v.toLowerCase())
    .optional(),
  scheduledAt: z.string().datetime().optional().or(z.literal("")),
});

export const createTrendSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  lifecycle: z.enum(["emerging", "rising", "peak", "saturating", "declining"]).optional(),
  relevance: z.string().optional(),
  recommendation: z.string().optional(),
  source: z.string().optional(),
});

export const createCompetitorSchema = z.object({
  name: z.string().min(1).max(200),
  handle: z.string().max(100).optional(),
  platform: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(5000).optional(),
});

-- CreateTable
CREATE TABLE "CreatorProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "creatorNiche" TEXT,
    "contentNiche" TEXT,
    "personalBrand" TEXT,
    "contentPillars" TEXT,
    "creatorVoice" TEXT,
    "personality" TEXT,
    "speakingStyle" TEXT,
    "visualStyle" TEXT,
    "audience" TEXT,
    "creatorGoals" TEXT,
    "monetization" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreatorProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentPillar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creatorProfileId" TEXT,
    CONSTRAINT "ContentPillar_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContentPillar_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "CreatorProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Collaboration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "partnerHandle" TEXT,
    "niche" TEXT,
    "matchScore" REAL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "idea" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Collaboration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BrandDeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "campaign" TEXT,
    "deliverables" TEXT,
    "platform" TEXT,
    "deadline" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "compensation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BrandDeal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonetizationChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonetizationChannel_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "industry" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "profileType" TEXT NOT NULL DEFAULT 'BUSINESS',
    "modelPolicy" TEXT NOT NULL DEFAULT 'BEST_AVAILABLE',
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "allowPaidGeneration" BOOLEAN NOT NULL DEFAULT false,
    "allowAutonomousReplan" BOOLEAN NOT NULL DEFAULT false,
    "allowedProviders" TEXT,
    "allowedPlatforms" TEXT
);
INSERT INTO "new_Company" ("allowAutonomousReplan", "allowPaidGeneration", "allowedPlatforms", "allowedProviders", "createdAt", "description", "id", "industry", "logoUrl", "modelPolicy", "name", "requireApproval", "slug", "updatedAt", "website") SELECT "allowAutonomousReplan", "allowPaidGeneration", "allowedPlatforms", "allowedProviders", "createdAt", "description", "id", "industry", "logoUrl", "modelPolicy", "name", "requireApproval", "slug", "updatedAt", "website" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");
CREATE INDEX "Company_slug_idx" ON "Company"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CreatorProfile_companyId_key" ON "CreatorProfile"("companyId");

-- CreateIndex
CREATE INDEX "ContentPillar_companyId_idx" ON "ContentPillar"("companyId");

-- CreateIndex
CREATE INDEX "Collaboration_companyId_idx" ON "Collaboration"("companyId");

-- CreateIndex
CREATE INDEX "BrandDeal_companyId_idx" ON "BrandDeal"("companyId");

-- CreateIndex
CREATE INDEX "MonetizationChannel_companyId_idx" ON "MonetizationChannel"("companyId");

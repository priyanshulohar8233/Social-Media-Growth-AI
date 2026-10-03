-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "scopes" TEXT,
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "companyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingStep" TEXT NOT NULL DEFAULT 'REGISTERED',
ADD COLUMN     "onboardingTourCompleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandDetail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "businessType" TEXT NOT NULL,
    "industry" TEXT,
    "contentType" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoVisibility" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "promptSet" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "engine" TEXT NOT NULL DEFAULT 'gateway',
    "brandMentioned" BOOLEAN NOT NULL DEFAULT false,
    "sentiment" TEXT,
    "position" INTEGER,
    "citations" TEXT,
    "rawExcerpt" TEXT,
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoVisibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_tokenHash_idx" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "BrandDetail_userId_idx" ON "BrandDetail"("userId");

-- CreateIndex
CREATE INDEX "BrandDetail_companyId_idx" ON "BrandDetail"("companyId");

-- CreateIndex
CREATE INDEX "GeoVisibility_companyId_idx" ON "GeoVisibility"("companyId");

-- CreateIndex
CREATE INDEX "GeoVisibility_promptSet_idx" ON "GeoVisibility"("promptSet");

-- CreateIndex
CREATE INDEX "SocialAccount_userId_idx" ON "SocialAccount"("userId");

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandDetail" ADD CONSTRAINT "BrandDetail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoVisibility" ADD CONSTRAINT "GeoVisibility_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

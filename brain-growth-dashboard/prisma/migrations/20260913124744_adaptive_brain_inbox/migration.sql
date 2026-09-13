-- CreateTable
CREATE TABLE "InboxMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "channelType" TEXT NOT NULL DEFAULT 'message',
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "threadId" TEXT,
    "authorHandle" TEXT,
    "authorName" TEXT,
    "content" TEXT NOT NULL,
    "sentiment" TEXT,
    "intent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "replyText" TEXT,
    "repliedAt" DATETIME,
    "aiSuggestion" TEXT,
    "aiSuggestionTone" TEXT,
    "sourceMessageId" TEXT,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BrainInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CANDIDATE',
    "entityKind" TEXT,
    "entityId" TEXT,
    "relatedMemoryId" TEXT,
    "feedback" TEXT,
    "lastReinforcedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BrainInsight_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BrainInsight_relatedMemoryId_fkey" FOREIGN KEY ("relatedMemoryId") REFERENCES "Memory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LearningEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "source" TEXT,
    "dedupeKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "InboxMessage_companyId_idx" ON "InboxMessage"("companyId");

-- CreateIndex
CREATE INDEX "InboxMessage_platform_idx" ON "InboxMessage"("platform");

-- CreateIndex
CREATE INDEX "InboxMessage_status_idx" ON "InboxMessage"("status");

-- CreateIndex
CREATE INDEX "BrainInsight_companyId_idx" ON "BrainInsight"("companyId");

-- CreateIndex
CREATE INDEX "BrainInsight_type_idx" ON "BrainInsight"("type");

-- CreateIndex
CREATE INDEX "BrainInsight_status_idx" ON "BrainInsight"("status");

-- CreateIndex
CREATE INDEX "BrainInsight_entityKind_idx" ON "BrainInsight"("entityKind");

-- CreateIndex
CREATE INDEX "BrainInsight_companyId_status_idx" ON "BrainInsight"("companyId", "status");

-- CreateIndex
CREATE INDEX "LearningEvent_companyId_idx" ON "LearningEvent"("companyId");

-- CreateIndex
CREATE INDEX "LearningEvent_eventType_idx" ON "LearningEvent"("eventType");

-- CreateIndex
CREATE INDEX "LearningEvent_dedupeKey_idx" ON "LearningEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "LearningEvent_status_idx" ON "LearningEvent"("status");

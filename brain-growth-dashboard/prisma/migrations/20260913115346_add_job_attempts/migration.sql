-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GenerationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "prompt" TEXT,
    "modelId" TEXT,
    "provider" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "input" TEXT,
    "output" TEXT,
    "error" TEXT,
    "cost" REAL,
    "tokensUsed" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GenerationJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GenerationJob" ("companyId", "cost", "createdAt", "error", "id", "input", "kind", "modelId", "output", "prompt", "provider", "status", "tokensUsed", "updatedAt") SELECT "companyId", "cost", "createdAt", "error", "id", "input", "kind", "modelId", "output", "prompt", "provider", "status", "tokensUsed", "updatedAt" FROM "GenerationJob";
DROP TABLE "GenerationJob";
ALTER TABLE "new_GenerationJob" RENAME TO "GenerationJob";
CREATE INDEX "GenerationJob_companyId_idx" ON "GenerationJob"("companyId");
CREATE INDEX "GenerationJob_status_idx" ON "GenerationJob"("status");
CREATE INDEX "GenerationJob_kind_idx" ON "GenerationJob"("kind");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

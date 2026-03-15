-- Add job type column
ALTER TABLE "Job" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'draft';

-- Make botId optional
ALTER TABLE "Job" ALTER COLUMN "botId" DROP NOT NULL;

-- Rename status 'locked' to 'running'
UPDATE "Job" SET "status" = 'running' WHERE "status" = 'locked';

-- Replace old index with type-aware index
DROP INDEX IF EXISTS "Job_status_scheduledAt_idx";
CREATE INDEX "Job_type_status_scheduledAt_idx" ON "Job"("type", "status", "scheduledAt");

-- CreateTable
CREATE TABLE "JobConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "jobType" TEXT NOT NULL,
    "intervalMs" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobConfig_jobType_key" ON "JobConfig"("jobType");

-- Seed default job configs
INSERT INTO "JobConfig" ("id", "jobType", "intervalMs", "enabled", "updatedAt", "createdAt")
VALUES
    (gen_random_uuid(), 'draft', 120000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'publish', 60000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'cleanup', 10800000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

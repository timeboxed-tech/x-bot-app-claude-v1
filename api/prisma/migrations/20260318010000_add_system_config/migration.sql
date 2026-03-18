-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- Migrate x_search_hours_back from SystemPrompt to SystemConfig
INSERT INTO "SystemConfig" ("id", "key", "name", "value", "updatedAt", "createdAt")
VALUES (gen_random_uuid(), 'x_search_hours_back', 'X Search Time Period (hours)', '48', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Remove x_search_hours_back from SystemPrompt table
DELETE FROM "SystemPrompt" WHERE "key" = 'x_search_hours_back';

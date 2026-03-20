CREATE TABLE "ApiLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "requestHeaders" TEXT,
    "requestBody" TEXT,
    "responseStatus" INTEGER,
    "responseHeaders" TEXT,
    "responseBody" TEXT,
    "durationMs" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ApiLog_provider_createdAt_idx" ON "ApiLog"("provider", "createdAt");
CREATE INDEX "ApiLog_createdAt_idx" ON "ApiLog"("createdAt");

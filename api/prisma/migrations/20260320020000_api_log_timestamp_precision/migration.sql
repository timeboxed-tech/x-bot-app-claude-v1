-- Increase ApiLog.createdAt precision to microseconds (max for PostgreSQL)
ALTER TABLE "ApiLog" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(6);

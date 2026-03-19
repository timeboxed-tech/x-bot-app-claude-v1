-- Make post-publish a recurring job (15 min interval)
UPDATE "JobConfig" SET "intervalMs" = 900000, "updatedAt" = CURRENT_TIMESTAMP
WHERE "jobType" = 'post-publish';

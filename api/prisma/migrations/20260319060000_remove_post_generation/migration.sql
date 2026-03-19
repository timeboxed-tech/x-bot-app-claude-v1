-- Remove post-generation job config (merged into scheduler-tick)
DELETE FROM "JobConfig" WHERE "jobType" = 'post-generation';

-- Clean up any pending post-generation jobs
UPDATE "Post" SET "jobId" = NULL WHERE "jobId" IN (
  SELECT "id" FROM "Job" WHERE "type" = 'post-generation'
);
DELETE FROM "Job" WHERE "type" = 'post-generation';

-- Also clean up any remaining old job types
UPDATE "Post" SET "jobId" = NULL WHERE "jobId" IN (
  SELECT "id" FROM "Job" WHERE "type" IN ('draft', 'publish')
);
DELETE FROM "Job" WHERE "type" IN ('draft', 'publish');
DELETE FROM "JobConfig" WHERE "jobType" IN ('draft', 'publish');

-- Rename scheduler-tick to post-generator
UPDATE "JobConfig" SET "jobType" = 'post-generator', "updatedAt" = CURRENT_TIMESTAMP
WHERE "jobType" = 'scheduler-tick';
UPDATE "Job" SET "type" = 'post-generator' WHERE "type" = 'scheduler-tick';

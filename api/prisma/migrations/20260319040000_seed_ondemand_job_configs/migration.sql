-- Delete old job configs for removed job types
DELETE FROM "JobConfig" WHERE "jobType" IN ('draft', 'publish');

-- Seed on-demand job configs (intervalMs=0 since they don't self-reschedule)
INSERT INTO "JobConfig" ("id", "jobType", "intervalMs", "description", "enabled", "updatedAt", "createdAt")
VALUES
  (gen_random_uuid(), 'post-generation', 0, 'Generates a single draft post for one bot', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'post-publish', 0, 'Publishes approved posts whose scheduled time has arrived', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("jobType") DO UPDATE SET
  "description" = EXCLUDED."description",
  "updatedAt" = CURRENT_TIMESTAMP;

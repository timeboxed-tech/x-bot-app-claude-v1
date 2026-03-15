import { v4 as uuidv4 } from 'uuid';
import { jobRepository } from '../repositories/jobRepository.js';
import { jobConfigRepository } from '../repositories/jobConfigRepository.js';
import { handleDraftJob } from './draftHandler.js';
import { handlePublishJob } from './publishHandler.js';
import { handleCleanupJob } from './cleanupHandler.js';
import { log } from './activityLog.js';

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '30000', 10);

// Hardcoded fallback intervals (used when DB lookup fails)
const DRAFT_INTERVAL_MS = parseInt(process.env.DRAFT_JOB_INTERVAL_MS || '120000', 10); // 2 min
const PUBLISH_INTERVAL_MS = parseInt(process.env.PUBLISH_JOB_INTERVAL_MS || '60000', 10); // 1 min
const CLEANUP_INTERVAL_MS = parseInt(
  process.env.CLEANUP_JOB_INTERVAL_MS || String(3 * 60 * 60 * 1000),
  10,
); // 3 hours

const FALLBACK_INTERVALS: Record<string, number> = {
  draft: DRAFT_INTERVAL_MS,
  publish: PUBLISH_INTERVAL_MS,
  cleanup: CLEANUP_INTERVAL_MS,
};

// Simple in-memory cache with 5-minute TTL
const jobConfigCache = new Map<
  string,
  { intervalMs: number; enabled: boolean; expiresAt: number }
>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getCachedJobConfig(
  jobType: string,
): Promise<{ intervalMs: number; enabled: boolean }> {
  const cached = jobConfigCache.get(jobType);
  if (cached && cached.expiresAt > Date.now()) {
    return { intervalMs: cached.intervalMs, enabled: cached.enabled };
  }

  try {
    const config = await jobConfigRepository.findByJobType(jobType);
    if (config) {
      jobConfigCache.set(jobType, {
        intervalMs: config.intervalMs,
        enabled: config.enabled,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return { intervalMs: config.intervalMs, enabled: config.enabled };
    }
  } catch {
    // Fall back to hardcoded defaults on DB error
  }

  const fallbackInterval = FALLBACK_INTERVALS[jobType] ?? 60000;
  return { intervalMs: fallbackInterval, enabled: true };
}

const JOB_HANDLERS: Record<string, (jobId: string) => Promise<void>> = {
  draft: handleDraftJob,
  publish: handlePublishJob,
  cleanup: handleCleanupJob,
};

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let running = false;

/**
 * Ensures a pending job exists for each type on startup.
 */
async function ensureInitialJobs(): Promise<void> {
  for (const type of Object.keys(JOB_HANDLERS)) {
    try {
      await jobRepository.ensureJobExists(type, new Date());
      log('dispatcher', `Ensured ${type} job exists`);
    } catch (err) {
      console.error(`[dispatcher] Failed to ensure ${type} job:`, err);
    }
  }
}

/**
 * Schedules the next job of the given type after completion.
 * Fetches interval from DB (with cache), skips if job type is disabled.
 */
async function scheduleNextJob(type: string): Promise<void> {
  const config = await getCachedJobConfig(type);

  if (!config.enabled) {
    log('dispatcher', `Job type ${type} is disabled, skipping scheduling`);
    return;
  }

  const nextScheduledAt = new Date(Date.now() + config.intervalMs);
  await jobRepository.create({
    type,
    scheduledAt: nextScheduledAt,
    status: 'pending',
  });

  log('dispatcher', `Scheduled next ${type} job at ${nextScheduledAt.toISOString()}`);
}

async function processJobs(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const pendingJobs = await jobRepository.findPendingJobs(10);

    if (pendingJobs.length > 0) {
      log('dispatcher', `Poll: found ${pendingJobs.length} pending job(s)`);
    }

    for (const job of pendingJobs) {
      const handler = JOB_HANDLERS[job.type];
      if (!handler) {
        log('dispatcher', `Unknown job type: ${job.type}`, 'error');
        await jobRepository.markFailed(job.id, `Unknown job type: ${job.type}`);
        continue;
      }

      const lockToken = uuidv4();
      const claimed = await jobRepository.claimJob(job.id, lockToken);
      if (!claimed) continue;

      try {
        await handler(job.id);
        await jobRepository.markCompleted(job.id);
        log('dispatcher', `Job ${job.id} (${job.type}) completed`);
      } catch (err) {
        const errorMsg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
        log(
          'dispatcher',
          `Job ${job.id} (${job.type}) failed: ${err instanceof Error ? err.message : String(err)}`,
          'error',
        );
        await jobRepository.markFailed(job.id, errorMsg);
      } finally {
        try {
          await scheduleNextJob(job.type);
        } catch (schedErr) {
          console.error(`[dispatcher] Failed to schedule next ${job.type} job:`, schedErr);
        }
      }
    }
  } catch (err) {
    log('dispatcher', `Poll error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    console.error('[dispatcher] Error polling for jobs:', err);
  } finally {
    running = false;
  }
}

export function start(): void {
  log('dispatcher', `Starting with poll interval ${POLL_INTERVAL_MS}ms`);
  console.log(`[dispatcher] Starting with poll interval ${POLL_INTERVAL_MS}ms`);

  // Ensure initial jobs exist, then start polling
  void ensureInitialJobs().then(() => {
    void processJobs();
    intervalHandle = setInterval(() => void processJobs(), POLL_INTERVAL_MS);
  });
}

export function stop(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  console.log('[dispatcher] Stopped');
}

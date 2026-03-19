import { v4 as uuidv4 } from 'uuid';
import { jobRepository } from '../repositories/jobRepository.js';
import { jobConfigRepository } from '../repositories/jobConfigRepository.js';
import { handleSchedulerTick } from './schedulerTickHandler.js';
import { handlePostApprover } from './postApproverHandler.js';
import { handlePostPublish } from './postPublishHandler.js';
import { handleCleanupJob } from './cleanupHandler.js';
import { log } from './activityLog.js';

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '30000', 10);

const FALLBACK_INTERVALS: Record<string, number> = {
  'post-generator': 15 * 60 * 1000, // 15 min
  'post-approver': 15 * 60 * 1000, // 15 min
  'post-publish': 15 * 60 * 1000, // 15 min
  cleanup: 6 * 60 * 60 * 1000, // 6 hours
};

// Recurring job types that self-reschedule after completion
const RECURRING_JOB_TYPES = ['post-generator', 'post-approver', 'post-publish', 'cleanup'];

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
  'post-generator': handleSchedulerTick,
  'post-approver': handlePostApprover,
  'post-publish': handlePostPublish,
  cleanup: handleCleanupJob,
};

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let running = false;

/**
 * Ensures a pending job exists for each recurring type on startup.
 */
async function ensureInitialJobs(): Promise<void> {
  for (const type of RECURRING_JOB_TYPES) {
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
 * Only recurring job types self-reschedule; on-demand types do not.
 */
async function scheduleNextJob(type: string): Promise<void> {
  // On-demand jobs don't self-reschedule
  if (!RECURRING_JOB_TYPES.includes(type)) return;

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
        if (RECURRING_JOB_TYPES.includes(job.type)) {
          try {
            await jobConfigRepository.updateLastRunAt(job.type);
          } catch {
            /* ignore */
          }
        }
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

export function invalidateJobConfigCache(jobType?: string): void {
  if (jobType) {
    jobConfigCache.delete(jobType);
  } else {
    jobConfigCache.clear();
  }
}

export function stop(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  console.log('[dispatcher] Stopped');
}

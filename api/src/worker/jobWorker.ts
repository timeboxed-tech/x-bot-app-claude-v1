import { v4 as uuidv4 } from 'uuid';
import { jobRepository } from '../repositories/jobRepository.js';
import { postRepository } from '../repositories/postRepository.js';
import { generateTweet } from '../services/aiService.js';
import { computeNextScheduledAt } from '../services/scheduler.js';
import { log } from './activityLog.js';

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '30000', 10);

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let running = false;

async function scheduleNextJob(bot: {
  id: string;
  postsPerDay: number;
  minIntervalHours: number;
  preferredHoursStart: number;
  preferredHoursEnd: number;
}): Promise<void> {
  const nextScheduledAt = computeNextScheduledAt(
    {
      postsPerDay: bot.postsPerDay,
      minIntervalHours: bot.minIntervalHours,
      preferredHoursStart: bot.preferredHoursStart,
      preferredHoursEnd: bot.preferredHoursEnd,
    },
    new Date(),
  );

  await jobRepository.create({
    botId: bot.id,
    scheduledAt: nextScheduledAt,
    status: 'pending',
  });

  console.log(
    `[jobWorker] Next job for bot ${bot.id} scheduled at ${nextScheduledAt.toISOString()}`,
  );
}

async function processJobs(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const pendingJobs = await jobRepository.findPendingJobs(10);
    log('jobWorker', `Poll: found ${pendingJobs.length} pending job(s)`);

    for (const job of pendingJobs) {
      const lockToken = uuidv4();
      const claimed = await jobRepository.claimJob(job.id, lockToken);

      if (!claimed) {
        continue;
      }

      const bot = job.bot;

      try {
        // Check if X account is connected
        if (!bot.xAccessToken) {
          const errorMsg = 'X account not connected — skipping content generation';
          log('jobWorker', `Job ${job.id}: ${errorMsg}`, 'warn');
          console.warn(`[jobWorker] Job ${job.id}: ${errorMsg}`);
          await jobRepository.markFailed(job.id, errorMsg);
          continue;
        }

        const result = await generateTweet(bot.prompt);

        if (!result.success) {
          const errorMsg = `AI generation failed: ${result.error}`;
          log('jobWorker', `Job ${job.id}: ${errorMsg}`, 'error');
          console.error(`[jobWorker] Job ${job.id}: ${errorMsg}`);
          await jobRepository.markFailed(job.id, errorMsg);
          continue;
        }

        const postStatus = bot.postMode === 'auto' ? 'scheduled' : 'draft';
        const scheduledAt = bot.postMode === 'auto' ? new Date() : null;

        await postRepository.create({
          botId: bot.id,
          jobId: job.id,
          content: result.content,
          status: postStatus,
          scheduledAt,
        });

        await jobRepository.markCompleted(job.id);
        log('jobWorker', `Job ${job.id} completed — created ${postStatus} post`);
        console.log(`[jobWorker] Job ${job.id} completed successfully`);
      } catch (err) {
        const errorMsg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
        log(
          'jobWorker',
          `Job ${job.id} error: ${err instanceof Error ? err.message : String(err)}`,
          'error',
        );
        console.error(`[jobWorker] Error processing job ${job.id}:`, err);
        await jobRepository.markFailed(job.id, errorMsg);
      } finally {
        // Always schedule next job, even after failure
        try {
          await scheduleNextJob(bot);
        } catch (schedErr) {
          console.error(`[jobWorker] Failed to schedule next job for bot ${bot.id}:`, schedErr);
        }
      }
    }
  } catch (err) {
    log('jobWorker', `Poll error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    console.error('[jobWorker] Error polling for jobs:', err);
  } finally {
    running = false;
  }
}

export function start(): void {
  console.log(`[jobWorker] Starting with poll interval ${POLL_INTERVAL_MS}ms`);
  // Run immediately on start
  void processJobs();
  intervalHandle = setInterval(() => void processJobs(), POLL_INTERVAL_MS);
}

export function stop(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  console.log('[jobWorker] Stopped');
}

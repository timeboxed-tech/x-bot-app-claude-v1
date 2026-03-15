import { v4 as uuidv4 } from 'uuid';
import { jobRepository } from '../repositories/jobRepository.js';
import { postRepository } from '../repositories/postRepository.js';
import { botTipRepository } from '../repositories/botTipRepository.js';
import { botStyleRepository } from '../repositories/botStyleRepository.js';
import { generateTweet } from '../services/aiService.js';
import { computeNextScheduledAt } from '../services/scheduler.js';
import { checkAndFlagPost } from '../services/urlValidationService.js';
import { log } from './activityLog.js';

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '30000', 10);
const CATCHUP_MINUTES = 15;

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

async function reconcileBots(): Promise<void> {
  try {
    const botsWithoutJobs = await jobRepository.findActiveBotsWithoutPendingJobs();

    if (botsWithoutJobs.length === 0) return;

    log('jobWorker', `Reconciliation: ${botsWithoutJobs.length} bot(s) have no pending jobs`);
    console.log(`[jobWorker] Reconciliation: ${botsWithoutJobs.length} bot(s) need new jobs`);

    for (const bot of botsWithoutJobs) {
      try {
        const recentPostCount = await postRepository.countRecentByBot(bot.id, 24);
        const isBehind = recentPostCount < bot.postsPerDay;

        let nextScheduledAt: Date;

        if (isBehind) {
          // Behind on frequency — schedule catch-up within 15 minutes
          const jitterMs = Math.floor(Math.random() * CATCHUP_MINUTES * 60 * 1000);
          nextScheduledAt = new Date(Date.now() + jitterMs);
          log(
            'jobWorker',
            `Reconciliation: bot ${bot.id} behind schedule (${recentPostCount}/${bot.postsPerDay} posts in 24h), catch-up in ${Math.round(jitterMs / 60000)}m`,
          );
        } else {
          const lastCompleted = bot.jobs[0]?.completedAt ?? null;
          const baseTime = lastCompleted ?? new Date();
          nextScheduledAt = computeNextScheduledAt(
            {
              postsPerDay: bot.postsPerDay,
              minIntervalHours: bot.minIntervalHours,
              preferredHoursStart: bot.preferredHoursStart,
              preferredHoursEnd: bot.preferredHoursEnd,
            },
            baseTime,
          );
        }

        await jobRepository.create({
          botId: bot.id,
          scheduledAt: nextScheduledAt,
          status: 'pending',
        });

        log(
          'jobWorker',
          `Reconciliation: created job for bot ${bot.id} scheduled at ${nextScheduledAt.toISOString()}`,
        );
        console.log(
          `[jobWorker] Reconciliation: created job for bot ${bot.id} at ${nextScheduledAt.toISOString()}`,
        );
      } catch (err) {
        console.error(`[jobWorker] Reconciliation: failed to create job for bot ${bot.id}:`, err);
      }
    }
  } catch (err) {
    log(
      'jobWorker',
      `Reconciliation error: ${err instanceof Error ? err.message : String(err)}`,
      'error',
    );
    console.error('[jobWorker] Reconciliation error:', err);
  }
}

async function processJobs(): Promise<void> {
  if (running) return;
  running = true;

  try {
    await reconcileBots();

    const pendingJobs = await jobRepository.findPendingJobs(10);
    log('jobWorker', `Poll: found ${pendingJobs.length} pending job(s)`);
    console.log(`[jobWorker] Poll: found ${pendingJobs.length} pending job(s)`);

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

        const tips = await botTipRepository.findByBotId(bot.id);
        const recentPosts = await postRepository.findRecentByBotId(bot.id, 10);
        const styles = await botStyleRepository.findActiveByBotId(bot.id);
        const selectedStyle =
          styles.length > 0 ? styles[Math.floor(Math.random() * styles.length)] : null;

        const effectiveSource =
          selectedStyle?.knowledgeSource && selectedStyle.knowledgeSource !== 'default'
            ? selectedStyle.knowledgeSource
            : bot.knowledgeSource;
        const result = await generateTweet(
          bot.prompt,
          tips.map((t: { content: string }) => t.content),
          recentPosts.map((p: { content: string }) => p.content),
          selectedStyle?.content,
          effectiveSource === 'ai+web',
        );

        if (!result.success) {
          const errorMsg = `AI generation failed: ${result.error}`;
          log('jobWorker', `Job ${job.id}: ${errorMsg}`, 'error');
          console.error(`[jobWorker] Job ${job.id}: ${errorMsg}`);
          await jobRepository.markFailed(job.id, errorMsg);
          continue;
        }

        const post = await postRepository.create({
          botId: bot.id,
          jobId: job.id,
          content: result.content,
          status: 'draft',
          scheduledAt: null,
          stylePrompt: selectedStyle?.content ?? null,
          styleTitle: selectedStyle?.title || null,
        });

        // Await URL validation before deciding publish status
        await checkAndFlagPost(post.id);

        // Re-fetch post to check if it was flagged
        const checkedPost = await postRepository.findById(post.id);
        const isFlagged = checkedPost?.flagged ?? false;

        // Only auto-schedule if not flagged and bot is in auto mode
        if (bot.postMode === 'auto' && !isFlagged) {
          await postRepository.update(post.id, {
            status: 'scheduled',
            scheduledAt: new Date(),
          });
        }

        const finalStatus = bot.postMode === 'auto' && !isFlagged ? 'scheduled' : 'draft';
        await jobRepository.markCompleted(job.id);
        log(
          'jobWorker',
          `Job ${job.id} completed — created ${finalStatus} post${isFlagged ? ' (flagged)' : ''}`,
        );
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
  log('jobWorker', `Starting with poll interval ${POLL_INTERVAL_MS}ms`);
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

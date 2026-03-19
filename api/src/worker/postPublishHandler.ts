import { prisma } from '../utils/prisma.js';
import { postRepository } from '../repositories/postRepository.js';
import { jobRepository } from '../repositories/jobRepository.js';
import { publishTweet } from '../services/xApiService.js';
import {
  isLikePostDraft,
  handleLikePostPublish,
  isReplyToPostDraft,
  handleReplyToPostPublish,
} from '../services/publishService.js';
import { log } from './activityLog.js';

const MAX_POSTS_PER_HOUR = 1;
const DEFER_JITTER_MS = 60 * 1000; // 0-60s jitter when deferring

/**
 * Post publish handler: publishes all approved posts whose scheduledAt <= now.
 * Enqueued by post-approver or human approval endpoint.
 * Stops processing when a rate limit is hit and defers remaining work.
 */
export async function handlePostPublish(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { bot: true } });
  if (!job?.bot) {
    log('post-publish', `Job ${jobId}: no bot found, skipping`, 'warn');
    return;
  }

  const bot = job.bot;
  if (!bot.active) {
    log('post-publish', `Bot ${bot.xAccountHandle || bot.id}: not active, cancelling`);
    return;
  }

  // Find all approved posts whose scheduledAt <= now for this bot
  const readyPosts = await prisma.post.findMany({
    where: {
      botId: bot.id,
      status: 'approved',
      scheduledAt: { lte: new Date() },
    },
    include: { bot: true },
    orderBy: { scheduledAt: 'asc' },
  });

  if (readyPosts.length === 0) {
    log(
      'post-publish',
      `Job ${jobId}: no approved posts ready for bot ${bot.xAccountHandle || bot.id}`,
    );
    return;
  }

  log(
    'post-publish',
    `Job ${jobId}: found ${readyPosts.length} approved post(s) ready for bot ${bot.xAccountHandle || bot.id}`,
  );

  for (const targetPost of readyPosts) {
    // Layer 1 rate limit: max 1 post per hour per bot
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const publishedLastHour = await postRepository.countPublishedByBotSince(bot.id, oneHourAgo);
    if (publishedLastHour >= MAX_POSTS_PER_HOUR) {
      const deferTo = new Date(Date.now() + 60 * 60 * 1000 + Math.random() * DEFER_JITTER_MS);
      await jobRepository.create({
        type: 'post-publish',
        botId: bot.id,
        scheduledAt: deferTo,
      });
      log(
        'post-publish',
        `Bot ${bot.xAccountHandle || bot.id}: rate limited (layer 1), deferred to ${deferTo.toISOString()}`,
        'warn',
      );
      break;
    }

    // Layer 2 rate limit: min gap hours
    if (bot.postMode === 'with-approval' || bot.postMode === 'auto') {
      const lastPublished = await postRepository.findLastPublishedByBot(bot.id);
      if (lastPublished?.publishedAt) {
        const minGapMs = bot.minIntervalHours * 60 * 60 * 1000;
        const elapsed = Date.now() - new Date(lastPublished.publishedAt).getTime();
        if (elapsed < minGapMs) {
          const deferTo = new Date(new Date(lastPublished.publishedAt).getTime() + minGapMs);
          await jobRepository.create({
            type: 'post-publish',
            botId: bot.id,
            scheduledAt: deferTo,
          });
          log(
            'post-publish',
            `Bot ${bot.xAccountHandle || bot.id}: rate limited (layer 2, min gap), deferred to ${deferTo.toISOString()}`,
            'warn',
          );
          break;
        }
      }
    }

    // Publish
    const content = targetPost.content;
    if (!content || content.trim() === '') {
      await postRepository.update(targetPost.id, { status: 'failed' });
      log('post-publish', `Post ${targetPost.id}: empty content, marking as failed`, 'error');
      continue;
    }

    try {
      if (isLikePostDraft(targetPost)) {
        const likeResult = await handleLikePostPublish(targetPost, bot);
        if (likeResult.success) {
          await postRepository.update(targetPost.id, {
            status: 'published',
            publishedAt: new Date(),
            metadata: likeResult.updatedMetadata,
          });
          log(
            'post-publish',
            `Published like_post ${targetPost.id}: liked ${likeResult.likedCount}/${likeResult.totalCount} tweets`,
          );
        } else {
          throw new Error(likeResult.error || 'Like post failed');
        }
      } else if (isReplyToPostDraft(targetPost)) {
        const replyResult = await handleReplyToPostPublish(targetPost, bot);
        if (replyResult.success) {
          await postRepository.update(targetPost.id, {
            status: 'published',
            publishedAt: new Date(),
            metadata: replyResult.updatedMetadata,
          });
          log(
            'post-publish',
            `Published reply_to_post ${targetPost.id} as tweet ${replyResult.tweetId ?? 'unknown'}`,
          );
        } else {
          throw new Error(replyResult.error || 'Reply post failed');
        }
      } else {
        const result = await publishTweet(content, bot.xAccessToken, bot.xAccessSecret, bot.id);
        if (result.success) {
          await postRepository.update(targetPost.id, {
            status: 'published',
            publishedAt: new Date(),
          });
          log(
            'post-publish',
            `Published post ${targetPost.id} as tweet ${result.tweetId ?? 'unknown'}`,
          );
        } else {
          throw new Error(result.error || 'Publish failed');
        }
      }
    } catch (err) {
      log(
        'post-publish',
        `Post ${targetPost.id} publish failed: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
      await postRepository.update(targetPost.id, { status: 'failed' });
      // Continue to next post instead of failing the entire job
    }
  }
}

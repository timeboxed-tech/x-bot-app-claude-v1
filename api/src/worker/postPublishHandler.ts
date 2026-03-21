import { prisma } from '../utils/prisma.js';
import { postRepository } from '../repositories/postRepository.js';
import { publishTweet } from '../services/xApiService.js';
import {
  isLikePostDraft,
  handleLikePostPublish,
  isReplyToPostDraft,
  handleReplyToPostPublish,
} from '../services/publishService.js';
import { findNextScheduledSlot } from '../services/scheduler.js';
import { buildPostingContext } from '../services/schedulerHelpers.js';
import { log } from './activityLog.js';

const MAX_POSTS_PER_HOUR = 1;

/**
 * Post publish handler: recurring job that iterates through all active bots,
 * assigns slots to unscheduled approved posts, and publishes ready posts.
 */
export async function handlePostPublish(_jobId: string): Promise<string> {
  const bots = await prisma.bot.findMany({
    where: {
      active: true,
      user: { archivedAt: null },
    },
  });

  let published = 0;
  let skipped = 0;
  let failed = 0;
  let slotsAssigned = 0;

  for (const bot of bots) {
    try {
      // 1. Assign slots to unscheduled approved posts for this bot
      const unscheduled = await prisma.post.findMany({
        where: {
          botId: bot.id,
          status: 'approved',
          scheduledAt: null,
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
      });

      if (unscheduled.length > 0) {
        let context = await buildPostingContext(bot.id);
        for (const post of unscheduled) {
          const slot = findNextScheduledSlot(
            {
              postsPerDay: bot.postsPerDay,
              minIntervalHours: bot.minIntervalHours,
              preferredHoursStart: bot.preferredHoursStart,
              preferredHoursEnd: bot.preferredHoursEnd,
              timezone: bot.timezone || 'UTC',
            },
            context,
            48,
          );
          if (slot) {
            await postRepository.update(post.id, { scheduledAt: slot });
            context = await buildPostingContext(bot.id);
            slotsAssigned++;
          }
        }
      }

      // 2. Publish ready posts for this bot
      const readyPosts = await prisma.post.findMany({
        where: {
          botId: bot.id,
          status: 'approved',
          scheduledAt: { lte: new Date() },
        },
        include: { bot: true },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
      });

      if (readyPosts.length === 0) continue;

      // Layer 1: max posts per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const publishedLastHour = await postRepository.countPublishedByBotSince(bot.id, oneHourAgo);
      if (publishedLastHour >= MAX_POSTS_PER_HOUR) {
        log(
          'post-publish',
          `Bot ${bot.xAccountHandle || bot.id}: rate limited (${publishedLastHour}/${MAX_POSTS_PER_HOUR}/hr)`,
          'warn',
        );
        skipped += readyPosts.length;
        continue;
      }

      // Layer 2: min gap hours
      if (bot.postMode === 'with-approval' || bot.postMode === 'auto') {
        const lastPublished = await postRepository.findLastPublishedByBot(bot.id);
        if (lastPublished?.publishedAt) {
          const minGapMs = bot.minIntervalHours * 60 * 60 * 1000;
          const elapsed = Date.now() - new Date(lastPublished.publishedAt).getTime();
          if (elapsed < minGapMs) {
            log(
              'post-publish',
              `Bot ${bot.xAccountHandle || bot.id}: min gap not met, skipping`,
              'warn',
            );
            skipped += readyPosts.length;
            continue;
          }
        }
      }

      // Publish one post per bot per run
      const post = readyPosts[0];
      const content = post.content;
      if (!content || content.trim() === '') {
        await postRepository.update(post.id, { status: 'failed' });
        log('post-publish', `Post ${post.id}: empty content, marking as failed`, 'error');
        failed++;
        continue;
      }

      try {
        if (isLikePostDraft(post)) {
          const likeResult = await handleLikePostPublish(post, bot);
          if (likeResult.success) {
            await postRepository.update(post.id, {
              status: 'published',
              publishedAt: new Date(),
              metadata: likeResult.updatedMetadata,
            });
            log(
              'post-publish',
              `Published like_post ${post.id}: liked ${likeResult.likedCount}/${likeResult.totalCount} tweets`,
            );
            published++;
          } else {
            throw new Error(likeResult.error || 'Like post failed');
          }
        } else if (isReplyToPostDraft(post)) {
          const replyResult = await handleReplyToPostPublish(post, bot);
          if (replyResult.success) {
            await postRepository.update(post.id, {
              status: 'published',
              publishedAt: new Date(),
              metadata: replyResult.updatedMetadata,
            });
            log(
              'post-publish',
              `Published reply_to_post ${post.id} as tweet ${replyResult.tweetId ?? 'unknown'}`,
            );
            published++;
          } else {
            throw new Error(replyResult.error || 'Reply post failed');
          }
        } else {
          const result = await publishTweet(content, bot.xAccessToken, bot.xAccessSecret, bot.id);
          if (result.success) {
            await postRepository.update(post.id, {
              status: 'published',
              publishedAt: new Date(),
            });
            log(
              'post-publish',
              `Published post ${post.id} as tweet ${result.tweetId ?? 'unknown'}`,
            );
            published++;
          } else {
            throw new Error(result.error || 'Publish failed');
          }
        }
      } catch (err) {
        log(
          'post-publish',
          `Post ${post.id} publish failed: ${err instanceof Error ? err.message : String(err)}`,
          'error',
        );
        const reason = err instanceof Error ? err.message : String(err);
        await postRepository.update(post.id, {
          status: 'failed',
          flagReasons: [...((post.flagReasons as string[]) || []), `Publish failed: ${reason}`],
        });
        failed++;
      }
    } catch (err) {
      log(
        'post-publish',
        `Bot ${bot.xAccountHandle || bot.id}: error — ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
  }

  const parts = [];
  if (published > 0) parts.push(`published ${published}`);
  if (slotsAssigned > 0) parts.push(`assigned ${slotsAssigned} slot(s)`);
  if (skipped > 0) parts.push(`skipped ${skipped} (rate limit)`);
  if (failed > 0) parts.push(`failed ${failed}`);
  const message = parts.length > 0 ? parts.join(', ') : 'No posts ready to publish';
  log('post-publish', message);
  return message;
}

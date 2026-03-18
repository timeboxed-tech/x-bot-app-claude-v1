import { postRepository } from '../repositories/postRepository.js';
import { publishTweet } from '../services/xApiService.js';
import {
  isLikePostDraft,
  handleLikePostPublish,
  isReplyToPostDraft,
  handleReplyToPostPublish,
} from '../services/publishService.js';
import { log } from './activityLog.js';

const MAX_RETRIES = 3;
const RESCHEDULE_DELAY_MS = 30 * 60 * 1000; // 30 minutes

// In-memory retry counter: postId -> failure count
const retryCounts = new Map<string, number>();

/**
 * Publish handler: iterates through all bots with scheduled posts
 * and publishes them based on rate limits and bot config.
 */
export async function handlePublishJob(_jobId: string): Promise<void> {
  // Gather both scheduled posts and approved posts (from with-approval bots)
  const scheduledPosts = await postRepository.findScheduledReady(20);
  const approvedPosts = await postRepository.findApprovedReady(20);

  const posts = [...scheduledPosts, ...approvedPosts];
  log(
    'publish',
    `Found ${posts.length} post(s) ready to publish (${scheduledPosts.length} scheduled, ${approvedPosts.length} approved)`,
  );

  let published = 0;
  let rateLimited = 0;
  let failed = 0;
  let skippedInterval = 0;

  for (const post of posts) {
    const currentRetries = retryCounts.get(post.id) ?? 0;
    if (currentRetries >= MAX_RETRIES) {
      log('publish', `Post ${post.id}: max retries reached, discarding`, 'warn');
      await postRepository.update(post.id, { status: 'discarded' });
      retryCounts.delete(post.id);
      failed++;
      continue;
    }

    const bot = post.bot;

    // Preferred hours check: only publish within the bot's active window (in bot's timezone)
    if (bot.preferredHoursStart !== 0 || bot.preferredHoursEnd !== 24) {
      const now = new Date();
      const localTimeStr = now.toLocaleString('en-US', {
        timeZone: bot.timezone || 'UTC',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      });
      const [hourStr, minStr] = localTimeStr.split(':');
      const currentHourLocal = parseInt(hourStr, 10) + parseInt(minStr, 10) / 60;
      if (currentHourLocal < bot.preferredHoursStart || currentHourLocal >= bot.preferredHoursEnd) {
        if (post.status === 'scheduled') {
          const newScheduledAt = new Date(Date.now() + RESCHEDULE_DELAY_MS);
          await postRepository.update(post.id, { scheduledAt: newScheduledAt });
        }
        log(
          'publish',
          `Bot ${bot.xAccountHandle || bot.id}: outside preferred hours (${bot.preferredHoursStart}-${bot.preferredHoursEnd} ${bot.timezone || 'UTC'}), skipping`,
          'warn',
        );
        skippedInterval++;
        continue;
      }
    }

    // Daily rate limit: enforce postsPerDay from bot config
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const publishedLast24h = await postRepository.countPublishedByBotSince(bot.id, twentyFourHoursAgo);
    if (publishedLast24h >= bot.postsPerDay) {
      if (post.status === 'scheduled') {
        const newScheduledAt = new Date(Date.now() + RESCHEDULE_DELAY_MS);
        await postRepository.update(post.id, { scheduledAt: newScheduledAt });
      }
      log(
        'publish',
        `Bot ${bot.xAccountHandle || bot.id}: daily limit reached (${publishedLast24h}/${bot.postsPerDay}/day), skipping`,
        'warn',
      );
      rateLimited++;
      continue;
    }

    // Min interval check with jitter: apply to all post types
    const lastPublished = await postRepository.findLastPublishedByBot(bot.id);
    if (lastPublished?.publishedAt) {
      const hoursSinceLastPublish =
        (Date.now() - new Date(lastPublished.publishedAt).getTime()) / (1000 * 60 * 60);
      const jitteredInterval = bot.minIntervalHours * (0.85 + Math.random() * 0.3);
      if (hoursSinceLastPublish < jitteredInterval) {
        if (post.status === 'scheduled') {
          const newScheduledAt = new Date(Date.now() + RESCHEDULE_DELAY_MS);
          await postRepository.update(post.id, { scheduledAt: newScheduledAt });
        }
        log(
          'publish',
          `Bot ${bot.xAccountHandle || bot.id}: too soon since last publish (${hoursSinceLastPublish.toFixed(2)}h < ${jitteredInterval.toFixed(2)}h interval), skipping`,
          'warn',
        );
        skippedInterval++;
        continue;
      }
    }

    // Check if this is a like_post outcome
    const isLikePost = isLikePostDraft(post);

    if (isLikePost) {
      const likeResult = await handleLikePostPublish(post, bot);
      if (likeResult.success) {
        await postRepository.update(post.id, {
          status: 'published',
          publishedAt: new Date(),
          metadata: likeResult.updatedMetadata,
        });
        retryCounts.delete(post.id);
        published++;
        log(
          'publish',
          `Published like_post ${post.id}: liked ${likeResult.likedCount}/${likeResult.totalCount} tweets`,
        );
      } else {
        const newCount = currentRetries + 1;
        retryCounts.set(post.id, newCount);
        failed++;
        log(
          'publish',
          `Like post ${post.id} failed (attempt ${newCount}/${MAX_RETRIES}): ${likeResult.error}`,
          'error',
        );
        if (newCount >= MAX_RETRIES) {
          await postRepository.update(post.id, { status: 'discarded' });
          retryCounts.delete(post.id);
        }
      }
    } else if (isReplyToPostDraft(post)) {
      const replyResult = await handleReplyToPostPublish(post, bot);
      if (replyResult.success) {
        await postRepository.update(post.id, {
          status: 'published',
          publishedAt: new Date(),
          metadata: replyResult.updatedMetadata,
        });
        retryCounts.delete(post.id);
        published++;
        log(
          'publish',
          `Published reply_to_post ${post.id} as tweet ${replyResult.tweetId ?? 'unknown'}`,
        );
      } else {
        const newCount = currentRetries + 1;
        retryCounts.set(post.id, newCount);
        failed++;
        log(
          'publish',
          `Reply post ${post.id} failed (attempt ${newCount}/${MAX_RETRIES}): ${replyResult.error}`,
          'error',
        );
        if (newCount >= MAX_RETRIES) {
          await postRepository.update(post.id, { status: 'discarded' });
          retryCounts.delete(post.id);
        }
      }
    } else {
      const result = await publishTweet(post.content, bot.xAccessToken, bot.xAccessSecret, bot.id);

      if (result.success) {
        await postRepository.update(post.id, {
          status: 'published',
          publishedAt: new Date(),
        });
        retryCounts.delete(post.id);
        published++;
        log('publish', `Published post ${post.id} as tweet ${result.tweetId ?? 'unknown'}`);
      } else {
        const newCount = currentRetries + 1;
        retryCounts.set(post.id, newCount);
        failed++;

        log(
          'publish',
          `Post ${post.id} failed (attempt ${newCount}/${MAX_RETRIES}): ${result.error}`,
          'error',
        );

        if (newCount >= MAX_RETRIES) {
          await postRepository.update(post.id, { status: 'discarded' });
          retryCounts.delete(post.id);
        }
      }
    }
  }

  log(
    'publish',
    `Completed: ${published} published, ${rateLimited} rate-limited, ${failed} failed${skippedInterval > 0 ? `, ${skippedInterval} skipped (interval)` : ''}`,
  );
}

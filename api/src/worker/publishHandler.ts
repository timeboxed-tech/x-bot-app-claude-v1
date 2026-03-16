import { postRepository } from '../repositories/postRepository.js';
import { publishTweet } from '../services/xApiService.js';
import { isLikePostDraft, handleLikePostPublish } from '../services/publishService.js';
import { log } from './activityLog.js';

const MAX_RETRIES = 3;
const MAX_POSTS_PER_HOUR = 2;
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

    // Rate limit: max posts per hour per bot
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const publishedLastHour = await postRepository.countPublishedByBotSince(bot.id, oneHourAgo);
    if (publishedLastHour >= MAX_POSTS_PER_HOUR) {
      if (post.status === 'scheduled') {
        const newScheduledAt = new Date(Date.now() + RESCHEDULE_DELAY_MS);
        await postRepository.update(post.id, { scheduledAt: newScheduledAt });
      }
      log(
        'publish',
        `Bot ${bot.xAccountHandle || bot.id}: rate limited (${publishedLastHour}/${MAX_POSTS_PER_HOUR}/hr), rescheduled`,
        'warn',
      );
      rateLimited++;
      continue;
    }

    // For approved posts (with-approval mode): respect bot's posting frequency
    if (post.status === 'approved') {
      const lastPublished = await postRepository.findLastPublishedByBot(bot.id);
      if (lastPublished?.publishedAt) {
        const hoursSinceLastPublish =
          (Date.now() - new Date(lastPublished.publishedAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastPublish < bot.minIntervalHours) {
          skippedInterval++;
          continue;
        }
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

import { prisma } from '../utils/prisma.js';
import { postRepository } from '../repositories/postRepository.js';
import { publishTweet } from '../services/xApiService.js';
import {
  isLikePostDraft,
  handleLikePostPublish,
  isReplyToPostDraft,
  handleReplyToPostPublish,
} from '../services/publishService.js';
import { log } from './activityLog.js';

const MAX_POSTS_PER_HOUR = 1;

/**
 * Post publish handler: recurring job that finds all approved posts
 * with scheduledAt <= now and publishes them, respecting rate limits.
 * Skips bots that are rate-limited and moves to the next.
 */
export async function handlePostPublish(_jobId: string): Promise<void> {
  // Find all approved posts ready to publish across all bots
  const readyPosts = await prisma.post.findMany({
    where: {
      status: 'approved',
      scheduledAt: { lte: new Date() },
      bot: { active: true, user: { archivedAt: null } },
    },
    include: { bot: true },
    orderBy: { scheduledAt: 'asc' },
    take: 50,
  });

  if (readyPosts.length === 0) {
    return;
  }

  log('post-publish', `Found ${readyPosts.length} approved post(s) ready to publish`);

  // Track rate-limited bots so we skip them
  const rateLimitedBots = new Set<string>();
  let published = 0;
  let skipped = 0;
  let failed = 0;

  for (const post of readyPosts) {
    const bot = post.bot;

    // Skip if this bot is already rate-limited in this run
    if (rateLimitedBots.has(bot.id)) {
      skipped++;
      continue;
    }

    // Layer 1: max posts per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const publishedLastHour = await postRepository.countPublishedByBotSince(bot.id, oneHourAgo);
    if (publishedLastHour >= MAX_POSTS_PER_HOUR) {
      rateLimitedBots.add(bot.id);
      log(
        'post-publish',
        `Bot ${bot.xAccountHandle || bot.id}: rate limited (${publishedLastHour}/${MAX_POSTS_PER_HOUR}/hr), skipping`,
        'warn',
      );
      skipped++;
      continue;
    }

    // Layer 2: min gap hours
    if (bot.postMode === 'with-approval' || bot.postMode === 'auto') {
      const lastPublished = await postRepository.findLastPublishedByBot(bot.id);
      if (lastPublished?.publishedAt) {
        const minGapMs = bot.minIntervalHours * 60 * 60 * 1000;
        const elapsed = Date.now() - new Date(lastPublished.publishedAt).getTime();
        if (elapsed < minGapMs) {
          rateLimitedBots.add(bot.id);
          log(
            'post-publish',
            `Bot ${bot.xAccountHandle || bot.id}: min gap not met, skipping`,
            'warn',
          );
          skipped++;
          continue;
        }
      }
    }

    // Check content
    const content = post.content;
    if (!content || content.trim() === '') {
      await postRepository.update(post.id, { status: 'failed' });
      log('post-publish', `Post ${post.id}: empty content, marking as failed`, 'error');
      failed++;
      continue;
    }

    // Publish
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
          log('post-publish', `Published post ${post.id} as tweet ${result.tweetId ?? 'unknown'}`);
          published++;
        } else {
          throw new Error(result.error || 'Publish failed');
        }
      }
      // After publishing, mark bot rate-limited for this run
      rateLimitedBots.add(bot.id);
    } catch (err) {
      log(
        'post-publish',
        `Post ${post.id} publish failed: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
      await postRepository.update(post.id, { status: 'failed' });
      failed++;
    }
  }

  if (published > 0 || failed > 0 || skipped > 0) {
    log(
      'post-publish',
      `Completed: ${published} published, ${skipped} skipped (rate limit), ${failed} failed`,
    );
  }
}

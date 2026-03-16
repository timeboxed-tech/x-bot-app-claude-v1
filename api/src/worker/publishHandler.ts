import { postRepository } from '../repositories/postRepository.js';
import { publishTweet, likeTweet } from '../services/xApiService.js';
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

/**
 * Check if a post is a like_post draft by inspecting its metadata.
 */
function isLikePostDraft(post: {
  metadata?: string | null;
  generationPrompt?: string | null;
}): boolean {
  if (post.metadata) {
    try {
      const meta = JSON.parse(post.metadata);
      if (meta.outcome === 'like_post') return true;
    } catch {
      // ignore parse errors
    }
  }
  if (post.generationPrompt) {
    try {
      const gen = JSON.parse(post.generationPrompt);
      if (gen.outcome === 'like_post') return true;
    } catch {
      // ignore parse errors
    }
  }
  return false;
}

/**
 * Handle publishing a like_post draft: like each tweet via X API.
 */
async function handleLikePostPublish(
  post: { id: string; metadata?: string | null; content: string },
  bot: { id: string; xAccessToken: string; xAccessSecret: string; xAccountHandle: string },
): Promise<{
  success: boolean;
  likedCount: number;
  totalCount: number;
  error?: string;
  updatedMetadata?: string;
}> {
  let tweetIds: string[] = [];

  // Try to get tweet IDs from metadata
  if (post.metadata) {
    try {
      const meta = JSON.parse(post.metadata);
      if (Array.isArray(meta.tweetIds)) {
        tweetIds = meta.tweetIds;
      }
    } catch {
      // fall through to content parsing
    }
  }

  // Fallback: parse [tweet:ID] references from content
  if (tweetIds.length === 0) {
    const tweetIdRegex = /\[tweet:(\d+)\]/g;
    let match;
    while ((match = tweetIdRegex.exec(post.content)) !== null) {
      tweetIds.push(match[1]);
    }
  }

  if (tweetIds.length === 0) {
    return {
      success: false,
      likedCount: 0,
      totalCount: 0,
      error: 'No tweet IDs found in post metadata or content',
    };
  }

  let likedCount = 0;
  const errors: string[] = [];

  for (const tweetId of tweetIds) {
    try {
      const result = await likeTweet(tweetId, bot.xAccessToken, bot.xAccessSecret, bot.id);
      if (result.success) {
        likedCount++;
        log('publish', `Liked tweet ${tweetId} for bot ${bot.xAccountHandle || bot.id}`);
      } else {
        const errorMsg = `Failed to like tweet ${tweetId}: ${result.error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
        log('publish', errorMsg, 'error');
      }
    } catch (err) {
      const errorMsg = `Error liking tweet ${tweetId}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      log('publish', errorMsg, 'error');
    }
  }

  // Update metadata with results
  let updatedMetadata: string | undefined;
  try {
    const existingMeta = post.metadata ? JSON.parse(post.metadata) : {};
    updatedMetadata = JSON.stringify({
      ...existingMeta,
      publishResults: {
        likedCount,
        totalCount: tweetIds.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch {
    updatedMetadata = undefined;
  }

  // Consider it a success if at least one like went through, or if there were no IDs
  // Mark as published even if some likes fail (per requirements)
  return {
    success: likedCount > 0 || tweetIds.length === 0,
    likedCount,
    totalCount: tweetIds.length,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    updatedMetadata,
  };
}

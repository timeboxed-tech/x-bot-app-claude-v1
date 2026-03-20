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
import { log } from './activityLog.js';

const MAX_POSTS_PER_HOUR = 1;

/**
 * Post publish handler: recurring job that finds all approved posts
 * with scheduledAt <= now and publishes them, respecting rate limits.
 * Also assigns scheduledAt to approved posts that don't have one yet.
 */
export async function handlePostPublish(_jobId: string): Promise<string> {
  // First: try to assign scheduledAt to approved posts without one
  await assignSlotsToUnscheduledPosts();

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
    return 'No posts ready to publish';
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
      const reason = err instanceof Error ? err.message : String(err);
      await postRepository.update(post.id, {
        status: 'failed',
        flagReasons: [...((post.flagReasons as string[]) || []), `Publish failed: ${reason}`],
      });
      failed++;
    }
  }

  const message = `Published ${published}, skipped ${skipped} (rate limit), failed ${failed}`;
  log('post-publish', message);
  return message;
}

async function assignSlotsToUnscheduledPosts(): Promise<void> {
  const unscheduled = await prisma.post.findMany({
    where: {
      status: 'approved',
      scheduledAt: null,
      bot: { active: true, user: { archivedAt: null } },
    },
    include: { bot: true },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  if (unscheduled.length === 0) return;

  let assigned = 0;
  for (const post of unscheduled) {
    const bot = post.bot;
    const tz = bot.timezone || 'UTC';
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const startOfToday = new Date(todayStr + 'T00:00:00Z');

    const [lastPublished, lastScheduled, publishedToday, approvedToday] = await Promise.all([
      prisma.post.findFirst({
        where: { botId: bot.id, status: 'published', publishedAt: { not: null } },
        orderBy: { publishedAt: 'desc' },
        select: { publishedAt: true },
      }),
      prisma.post.findFirst({
        where: { botId: bot.id, status: 'approved', scheduledAt: { not: null } },
        orderBy: { scheduledAt: 'desc' },
        select: { scheduledAt: true },
      }),
      postRepository.countPublishedByBotSince(bot.id, startOfToday),
      prisma.post.count({
        where: { botId: bot.id, status: 'approved', scheduledAt: { gte: startOfToday } },
      }),
    ]);

    const dates: Date[] = [];
    if (lastPublished?.publishedAt) dates.push(lastPublished.publishedAt);
    if (lastScheduled?.scheduledAt) dates.push(lastScheduled.scheduledAt);
    const lastPostAt = dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null;

    const slot = findNextScheduledSlot(
      {
        postsPerDay: bot.postsPerDay,
        minIntervalHours: bot.minIntervalHours,
        preferredHoursStart: bot.preferredHoursStart,
        preferredHoursEnd: bot.preferredHoursEnd,
        timezone: tz,
      },
      {
        lastPublishedOrScheduledAt: lastPostAt,
        publishedTodayCount: publishedToday,
        approvedTodayCount: approvedToday,
      },
      48,
    );

    if (slot) {
      await postRepository.update(post.id, { scheduledAt: slot });
      assigned++;
    }
  }

  if (assigned > 0) {
    log('post-publish', `Assigned scheduledAt to ${assigned} unscheduled approved post(s)`);
  }
}

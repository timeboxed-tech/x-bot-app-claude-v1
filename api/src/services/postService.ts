import { prisma } from '../utils/prisma.js';
import { botRepository } from '../repositories/botRepository.js';
import { postRepository } from '../repositories/postRepository.js';
import { botTipRepository } from '../repositories/botTipRepository.js';
import { tweakPost, generateTips } from './aiService.js';
import { findNextScheduledSlot } from './scheduler.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

type UpdatePostInput = {
  content?: string;
  rating?: number | null;
  status?: 'draft' | 'discarded' | 'approved';
  scheduledAt?: string | null;
  flagged?: boolean;
};

export const postService = {
  async listPosts(
    userId: string | undefined,
    options: { status?: string; page: number; pageSize: number; botId?: string },
  ) {
    const { botId, ...restOptions } = options;

    if (botId) {
      // Filter to a specific bot (still scoped to user's bots if not admin)
      if (userId) {
        const { bots } = await botRepository.findByUserId(userId, 1, 1000);
        const userBotIds = bots.map((b: { id: string }) => b.id);
        if (!userBotIds.includes(botId)) {
          return { posts: [], total: 0 };
        }
      }
      return postRepository.findByBotIds([botId], restOptions);
    }

    if (!userId) {
      // Admin show-all: no bot scoping
      return postRepository.findAll(restOptions);
    }

    const { bots } = await botRepository.findByUserId(userId, 1, 1000);
    const botIds = bots.map((b: { id: string }) => b.id);

    if (botIds.length === 0) {
      return { posts: [], total: 0 };
    }

    return postRepository.findByBotIds(botIds, restOptions);
  },

  async updatePost(postId: string, userId: string, input: UpdatePostInput) {
    const post = await postRepository.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }
    if (post.bot.userId !== userId) {
      throw new ForbiddenError('You do not have access to this post');
    }

    // Validate status transitions
    if (post.status === 'published') {
      throw new ForbiddenError('Cannot modify a published post');
    }
    if (post.status === 'failed' && input.status !== 'draft') {
      throw new ForbiddenError('Failed posts can only be moved back to draft');
    }
    if (post.status === 'discarded' && input.status !== 'draft') {
      throw new ForbiddenError('Discarded posts can only be reinstated to draft');
    }

    // Validate content changes: only allowed on drafts
    if (input.content !== undefined && post.status !== 'draft') {
      throw new ValidationError('Content can only be edited on draft posts');
    }

    // Validate rating constraints: NOT allowed on discarded posts (already blocked above)
    if (input.rating !== undefined && input.rating !== null) {
      if (input.rating < 1 || input.rating > 5 || !Number.isInteger(input.rating)) {
        throw new ValidationError('Rating must be an integer between 1 and 5');
      }
    }

    // Validate status transition
    if (input.status) {
      const allowed = getAllowedTransitions(post.status);
      if (!allowed.includes(input.status)) {
        throw new ValidationError(`Cannot transition from '${post.status}' to '${input.status}'`);
      }
    }

    const updateData: {
      content?: string;
      status?: string;
      rating?: number | null;
      scheduledAt?: Date | null;
      publishedAt?: Date | null;
      flagged?: boolean;
      flagReasons?: string[];
    } = {};

    if (input.content !== undefined) {
      updateData.content = input.content;
    }

    if (input.rating !== undefined) {
      updateData.rating = input.rating;
    }

    if (input.status === 'approved') {
      updateData.status = 'approved';
      if (input.scheduledAt) {
        updateData.scheduledAt = new Date(input.scheduledAt);
      } else if (!post.scheduledAt) {
        // Find optimal slot using bot config, recent posts, and randomization
        const slot = await findSlotForBot(post.bot);
        if (slot) {
          updateData.scheduledAt = slot;
        }
        // If no slot found, leave scheduledAt null — will be retried by post-publish
      }
    } else if (input.status === 'discarded') {
      updateData.status = 'discarded';
    } else if (input.status === 'draft') {
      updateData.status = 'draft';
      updateData.scheduledAt = null;
    }

    if (input.flagged === true) {
      updateData.flagged = true;
      updateData.flagReasons = [...(post.flagReasons as string[]), 'Manually flagged by user'];
    } else if (input.flagged === false) {
      updateData.flagged = false;
      updateData.flagReasons = [];
    }

    return postRepository.update(postId, updateData);
  },

  async tweakPost(
    postId: string,
    userId: string,
    feedback: string,
    previousMessages?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ) {
    const post = await postRepository.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }
    if (post.bot.userId !== userId) {
      throw new ForbiddenError('You do not have access to this post');
    }
    if (post.status !== 'draft') {
      throw new ValidationError('Only draft posts can be tweaked');
    }

    const result = await tweakPost(post.content, feedback, previousMessages);
    return result;
  },

  async acceptTweak(
    postId: string,
    userId: string,
    content: string,
    conversation: Array<{ role: string; content: string }>,
  ) {
    const post = await postRepository.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }
    if (post.bot.userId !== userId) {
      throw new ForbiddenError('You do not have access to this post');
    }
    if (post.status !== 'draft') {
      throw new ValidationError('Only draft posts can be updated');
    }

    const updatedPost = await postRepository.update(postId, { content });

    // Generate tips from the conversation (max 10 per bot)
    let newTips: Array<{ id: string; botId: string; content: string; createdAt: Date }> = [];
    try {
      const existingCount = await botTipRepository.countByBotId(post.botId);
      const slotsAvailable = Math.max(0, 10 - existingCount);
      if (slotsAvailable > 0) {
        const tipStrings = await generateTips(conversation);
        const tipsToSave = tipStrings.slice(0, slotsAvailable);
        if (tipsToSave.length > 0) {
          newTips = await botTipRepository.createMany(
            tipsToSave.map((tipContent) => ({
              botId: post.botId,
              content: tipContent,
            })),
          );
        }
      }
    } catch {
      // Tips generation is best-effort; don't fail the accept
    }

    return { post: updatedPost, newTips };
  },

  async deletePost(postId: string, userId: string) {
    const post = await postRepository.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }
    if (post.bot.userId !== userId) {
      throw new ForbiddenError('You do not have access to this post');
    }
    if (post.status !== 'discarded') {
      throw new ValidationError('Only discarded posts can be deleted');
    }
    await postRepository.delete(postId);
  },

  async getPostCounts(userId: string | undefined, botId?: string) {
    if (botId) {
      // Filter counts to a specific bot (still scoped to user's bots if not admin)
      if (userId) {
        const { bots } = await botRepository.findByUserId(userId, 1, 1000);
        const userBotIds = bots.map((b: { id: string }) => b.id);
        if (!userBotIds.includes(botId)) {
          return { draft: 0, approved: 0, published: 0, failed: 0, discarded: 0, total: 0 };
        }
      }
      return postRepository.countsByStatus([botId]);
    }

    if (!userId) {
      return postRepository.countsByStatus();
    }

    const { bots } = await botRepository.findByUserId(userId, 1, 1000);
    const botIds = bots.map((b: { id: string }) => b.id);

    if (botIds.length === 0) {
      return { draft: 0, approved: 0, published: 0, failed: 0, discarded: 0, total: 0 };
    }

    return postRepository.countsByStatus(botIds);
  },

  async deleteAllDiscarded(userId: string | undefined) {
    if (!userId) {
      // Admin show-all: delete all discarded posts
      const result = await postRepository.deleteAllDiscarded();
      return result.count;
    }

    const { bots } = await botRepository.findByUserId(userId, 1, 1000);
    const botIds = bots.map((b: { id: string }) => b.id);

    if (botIds.length === 0) {
      return 0;
    }

    const result = await postRepository.deleteDiscardedByBotIds(botIds);
    return result.count;
  },
};

async function findSlotForBot(bot: {
  id: string;
  postsPerDay: number;
  minIntervalHours: number;
  preferredHoursStart: number;
  preferredHoursEnd: number;
  timezone: string;
}): Promise<Date | null> {
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

  return findNextScheduledSlot(
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
}

function getAllowedTransitions(currentStatus: string): string[] {
  switch (currentStatus) {
    case 'draft':
      return ['approved', 'discarded'];
    case 'approved':
      return ['discarded', 'draft'];
    case 'failed':
      return ['draft'];
    case 'discarded':
      return ['draft'];
    default:
      return [];
  }
}

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { postService } from '../services/postService.js';
import { botService } from '../services/botService.js';
import { userRepository } from '../repositories/userRepository.js';
import { postRepository } from '../repositories/postRepository.js';
import { publishPostNow } from '../services/publishService.js';
import { findNextScheduledSlot } from '../services/scheduler.js';
import { buildPostingContext } from '../services/schedulerHelpers.js';
import { paginationSchema, uuidSchema } from '../utils/validation.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

const postListQuerySchema = paginationSchema.extend({
  status: z.string().optional(),
  showAll: z.string().optional(),
  botId: z.string().uuid().optional(),
});

const postIdParamSchema = z.object({
  id: uuidSchema,
});

const updatePostSchema = z.object({
  content: z.string().min(1, 'Content must not be empty').optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  status: z.enum(['draft', 'discarded', 'approved']).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  flagged: z.boolean().optional(),
});

const tweakPostSchema = z.object({
  feedback: z.string().min(1, 'Feedback is required'),
  previousMessages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .optional(),
});

const acceptTweakSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  conversation: z.array(
    z.object({
      role: z.string(),
      content: z.string(),
    }),
  ),
});

export const postController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { page, pageSize, status, showAll, botId } = postListQuerySchema.parse(req.query);

      let scopeToUser = true;
      if (showAll === 'true') {
        const user = await userRepository.findById(userId);
        if (user?.isAdmin) {
          scopeToUser = false;
        }
      }

      const { posts, total } = await postService.listPosts(scopeToUser ? userId : undefined, {
        status,
        page,
        pageSize,
        botId,
      });

      res.status(200).json({
        data: posts,
        meta: { page, pageSize, total },
      });
    } catch (err) {
      next(err);
    }
  },

  async counts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { showAll, botId } = postListQuerySchema.parse(req.query);

      let scopeToUser = true;
      if (showAll === 'true') {
        const user = await userRepository.findById(userId);
        if (user?.isAdmin) {
          scopeToUser = false;
        }
      }

      const counts = await postService.getPostCounts(scopeToUser ? userId : undefined, botId);
      res.status(200).json({ data: counts });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = postIdParamSchema.parse(req.params);
      const body = updatePostSchema.parse(req.body);
      const post = await postService.updatePost(id, userId, body);

      const warning =
        post.status === 'approved' && !post.scheduledAt
          ? 'No available slot found in the next 48 hours. Post will be scheduled when a slot opens up.'
          : undefined;

      res.status(200).json({
        data: post,
        ...(warning && { warning }),
      });
    } catch (err) {
      next(err);
    }
  },

  async tweak(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = postIdParamSchema.parse(req.params);
      const { feedback, previousMessages } = tweakPostSchema.parse(req.body);
      const result = await postService.tweakPost(id, userId, feedback, previousMessages);

      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  async acceptTweak(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = postIdParamSchema.parse(req.params);
      const { content, conversation } = acceptTweakSchema.parse(req.body);
      const result = await postService.acceptTweak(id, userId, content, conversation);

      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = postIdParamSchema.parse(req.params);
      await postService.deletePost(id, userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async publish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = postIdParamSchema.parse(req.params);

      const post = await postRepository.findById(id);
      if (!post) {
        throw new NotFoundError('Post not found');
      }
      if (post.bot.userId !== userId) {
        throw new ForbiddenError('You do not have access to this post');
      }

      const publishableStatuses = ['draft', 'approved'];
      if (!publishableStatuses.includes(post.status)) {
        throw new ValidationError(
          `Cannot publish a post with status '${post.status}'. Post must be draft or approved.`,
        );
      }

      const result = await publishPostNow(post, post.bot);

      if (!result.success) {
        res.status(502).json({
          error: result.error ?? 'Failed to publish to X',
        });
        return;
      }

      const updateData: { status: string; publishedAt: Date; metadata?: string | null } = {
        status: 'published',
        publishedAt: new Date(),
      };
      if (result.updatedMetadata) {
        updateData.metadata = result.updatedMetadata;
      }

      const updatedPost = await postRepository.update(id, updateData);

      res.status(200).json({
        data: updatedPost,
      });
    } catch (err) {
      next(err);
    }
  },

  async createManualDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: botId } = z.object({ id: uuidSchema }).parse(req.params);
      const { content } = z
        .object({
          content: z.string().min(1, 'Content is required').max(1000),
        })
        .parse(req.body);
      const userId = req.userId!;

      // Verify bot ownership (throws NotFoundError/ForbiddenError)
      await botService.getBot(botId, userId);

      const post = await postRepository.create({
        botId,
        content,
        status: 'draft',
      });

      res.status(201).json({ data: post });
    } catch (err) {
      next(err);
    }
  },

  async suggestSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = z.object({ id: uuidSchema }).parse(req.params);
      const userId = req.userId!;

      const post = await postRepository.findById(id);
      if (!post) throw new NotFoundError('Post not found');
      if (post.bot.userId !== userId) throw new ForbiddenError('Access denied');

      const bot = post.bot;

      // Build context
      const context = await buildPostingContext(bot.id);

      const slot = findNextScheduledSlot(
        {
          postsPerDay: bot.postsPerDay,
          minIntervalHours: bot.minIntervalHours,
          preferredHoursStart: bot.preferredHoursStart,
          preferredHoursEnd: bot.preferredHoursEnd,
          timezone: bot.timezone || 'UTC',
        },
        context,
        7 * 24, // 7-day search window for human
      );

      const outsideWindow = slot ? isOutsidePreferredWindow(slot, bot) : false;

      res.json({ data: { scheduledFor: slot?.toISOString() ?? null, outsideWindow } });
    } catch (err) {
      next(err);
    }
  },

  async approvePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = z.object({ id: uuidSchema }).parse(req.params);
      const { scheduledFor } = z
        .object({
          scheduledFor: z.string().datetime(),
        })
        .parse(req.body);
      const userId = req.userId!;

      const post = await postRepository.findById(id);
      if (!post) throw new NotFoundError('Post not found');
      if (post.bot.userId !== userId) throw new ForbiddenError('Access denied');

      // Validate: only draft or approved posts can be approved
      if (post.status !== 'draft' && post.status !== 'approved') {
        throw new ValidationError(`Cannot approve a post with status '${post.status}'`);
      }

      // Only manual and with-approval modes
      if (post.bot.postMode !== 'manual' && post.bot.postMode !== 'with-approval') {
        throw new ValidationError('Approve endpoint is only for manual and with-approval modes');
      }

      const scheduledAt = new Date(scheduledFor);
      const now = new Date();
      const maxDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      if (scheduledAt < now) {
        throw new ValidationError('scheduledFor must be in the future');
      }
      if (scheduledAt > maxDate) {
        throw new ValidationError('scheduledFor must be within 7 days');
      }

      // Approve and schedule — post-publish recurring job will pick it up
      await postRepository.update(post.id, {
        status: 'approved',
        scheduledAt,
      });

      const updated = await postRepository.findById(id);
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },

  async removeAllDiscarded(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { showAll } = postListQuerySchema.parse(req.query);

      let scopeToUser = true;
      if (showAll === 'true') {
        const user = await userRepository.findById(userId);
        if (user?.isAdmin) {
          scopeToUser = false;
        }
      }

      const count = await postService.deleteAllDiscarded(scopeToUser ? userId : undefined);
      res.status(200).json({ data: { count } });
    } catch (err) {
      next(err);
    }
  },
};

function isOutsidePreferredWindow(
  date: Date,
  bot: { preferredHoursStart: number; preferredHoursEnd: number; timezone: string },
): boolean {
  if (bot.preferredHoursStart === 0 && bot.preferredHoursEnd === 24) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: bot.timezone || 'UTC',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')!.value, 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')!.value, 10);
  const h = (hour === 24 ? 0 : hour) + minute / 60;
  return h < bot.preferredHoursStart || h >= bot.preferredHoursEnd;
}

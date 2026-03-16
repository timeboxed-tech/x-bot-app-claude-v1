import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { postService } from '../services/postService.js';
import { userRepository } from '../repositories/userRepository.js';
import { postRepository } from '../repositories/postRepository.js';
import { publishPostNow } from '../services/publishService.js';
import { paginationSchema, uuidSchema } from '../utils/validation.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

const postListQuerySchema = paginationSchema.extend({
  status: z.string().optional(),
  showAll: z.string().optional(),
});

const postIdParamSchema = z.object({
  id: uuidSchema,
});

const updatePostSchema = z.object({
  content: z.string().min(1, 'Content must not be empty').optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  status: z.enum(['draft', 'scheduled', 'discarded', 'approved']).optional(),
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
      const { page, pageSize, status, showAll } = postListQuerySchema.parse(req.query);

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
      const { showAll } = postListQuerySchema.parse(req.query);

      let scopeToUser = true;
      if (showAll === 'true') {
        const user = await userRepository.findById(userId);
        if (user?.isAdmin) {
          scopeToUser = false;
        }
      }

      const counts = await postService.getPostCounts(scopeToUser ? userId : undefined);
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

      res.status(200).json({
        data: post,
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

      const publishableStatuses = ['draft', 'approved', 'scheduled'];
      if (!publishableStatuses.includes(post.status)) {
        throw new ValidationError(
          `Cannot publish a post with status '${post.status}'. Post must be draft, approved, or scheduled.`,
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

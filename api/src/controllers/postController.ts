import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { postService } from '../services/postService.js';
import { userRepository } from '../repositories/userRepository.js';
import { paginationSchema, uuidSchema } from '../utils/validation.js';

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
  status: z.enum(['scheduled', 'discarded']).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
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
};

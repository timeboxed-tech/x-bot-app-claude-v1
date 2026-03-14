import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { postRepository } from '../repositories/postRepository.js';
import { postReviewRepository } from '../repositories/postReviewRepository.js';
import { botJudgeRepository } from '../repositories/botJudgeRepository.js';
import { botRepository } from '../repositories/botRepository.js';
import { botShareRepository } from '../repositories/botShareRepository.js';
import { uuidSchema } from '../utils/validation.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';
import { reviewPostWithJudge } from '../services/judgeAiService.js';

const postIdParamSchema = z.object({
  id: uuidSchema,
});

const reviewParamSchema = z.object({
  id: uuidSchema,
  reviewId: uuidSchema,
});

async function assertPostAccess(postId: string, userId: string) {
  const post = await postRepository.findById(postId);
  if (!post) {
    throw new NotFoundError('Post not found');
  }
  const bot = await botRepository.findById(post.botId);
  if (!bot) {
    throw new NotFoundError('Bot not found');
  }
  if (bot.userId !== userId) {
    const share = await botShareRepository.findByBotIdAndUserId(post.botId, userId);
    if (!share) {
      throw new ForbiddenError('You do not have access to this post');
    }
  }
  return post;
}

export const postReviewController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = postIdParamSchema.parse(req.params);
      await assertPostAccess(id, userId);

      const reviews = await postReviewRepository.findByPostId(id);
      res.status(200).json({ data: reviews });
    } catch (err) {
      next(err);
    }
  },

  async review(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = postIdParamSchema.parse(req.params);
      const post = await assertPostAccess(id, userId);

      // Get judges assigned to this bot
      const botJudges = await botJudgeRepository.findByBotId(post.botId);
      if (botJudges.length === 0) {
        throw new ValidationError('No judges assigned to this bot. Assign judges first.');
      }

      // Fetch recent posts for repetition context
      const recentPosts = await postRepository.findRecentByBotId(post.botId, 10);
      const recentContents = recentPosts
        .filter((rp: { content: string }) => rp.content !== post.content)
        .map((rp: { content: string }) => rp.content);

      // Call AI for each judge in parallel
      const reviewPromises = botJudges.map(
        async (bj: { judgeId: string; judge: { name: string; prompt: string } }) => {
          const result = await reviewPostWithJudge(
            bj.judge.name,
            bj.judge.prompt,
            post.content,
            recentContents,
          );
          return {
            postId: id,
            judgeId: bj.judgeId,
            rating: result.rating,
            opinion: result.opinion,
          };
        },
      );

      const reviewResults = await Promise.all(reviewPromises);
      const reviews = await postReviewRepository.createMany(reviewResults);

      res.status(201).json({ data: reviews });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id, reviewId } = reviewParamSchema.parse(req.params);
      await assertPostAccess(id, userId);

      await postReviewRepository.delete(reviewId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { postRepository } from '../repositories/postRepository.js';
import { postEvaluationRepository } from '../repositories/postEvaluationRepository.js';
import { botRepository } from '../repositories/botRepository.js';
import { botShareRepository } from '../repositories/botShareRepository.js';
import { evaluatePost } from '../services/aiService.js';
import { uuidSchema } from '../utils/validation.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

const postIdParamSchema = z.object({
  id: uuidSchema,
});

const evaluateSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  evaluationId: z.string().uuid().optional(),
});

type EvalMessage = { role: 'user' | 'assistant'; content: string };

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

export const evaluationController = {
  async evaluate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = postIdParamSchema.parse(req.params);
      const { message, evaluationId } = evaluateSchema.parse(req.body);

      const post = await assertPostAccess(id, userId);

      let messages: EvalMessage[] = [];
      let existingEvaluation = null;

      if (evaluationId) {
        existingEvaluation = await postEvaluationRepository
          .findByPostId(id)
          .then((evals) => evals.find((e) => e.id === evaluationId));
        if (existingEvaluation) {
          messages = JSON.parse(existingEvaluation.messages) as EvalMessage[];
        }
      }

      messages.push({ role: 'user', content: message });

      const aiResponse = await evaluatePost(messages, post.content, post.generationPrompt);

      messages.push({ role: 'assistant', content: aiResponse });

      let evaluation;
      if (existingEvaluation) {
        evaluation = await postEvaluationRepository.update(existingEvaluation.id, {
          messages: JSON.stringify(messages),
        });
      } else {
        evaluation = await postEvaluationRepository.create({
          postId: id,
          messages: JSON.stringify(messages),
        });
      }

      res.status(200).json({
        data: {
          evaluationId: evaluation.id,
          messages,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = postIdParamSchema.parse(req.params);
      await assertPostAccess(id, userId);

      const evaluations = await postEvaluationRepository.findByPostId(id);

      const data = evaluations.map((e) => ({
        id: e.id,
        postId: e.postId,
        messages: JSON.parse(e.messages) as EvalMessage[],
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));

      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },
};

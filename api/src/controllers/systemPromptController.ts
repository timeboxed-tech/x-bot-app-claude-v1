import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { systemPromptRepository } from '../repositories/systemPromptRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { uuidSchema } from '../utils/validation.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

const idParamSchema = z.object({
  id: uuidSchema,
});

const updateSystemPromptSchema = z.object({
  name: z.string().min(1, 'Name must not be empty').optional(),
  content: z.string().min(1, 'Content must not be empty').optional(),
});

async function assertAdmin(userId: string): Promise<void> {
  const user = await userRepository.findById(userId);
  if (!user?.isAdmin) {
    throw new ForbiddenError('Admin access required');
  }
}

export const systemPromptController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      await assertAdmin(userId);

      const prompts = await systemPromptRepository.findAll();
      res.status(200).json({ data: prompts });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      await assertAdmin(userId);

      const { id } = idParamSchema.parse(req.params);
      const body = updateSystemPromptSchema.parse(req.body);

      const existing = await systemPromptRepository.findAll();
      const found = existing.find((p) => p.id === id);
      if (!found) {
        throw new NotFoundError('System prompt not found');
      }

      const prompt = await systemPromptRepository.update(id, body);
      res.status(200).json({ data: prompt });
    } catch (err) {
      next(err);
    }
  },
};

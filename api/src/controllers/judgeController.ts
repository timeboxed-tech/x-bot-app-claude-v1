import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { judgeRepository } from '../repositories/judgeRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { uuidSchema } from '../utils/validation.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

const judgeIdParamSchema = z.object({
  id: uuidSchema,
});

const createJudgeSchema = z.object({
  name: z.string().min(1, 'Name must not be empty'),
  prompt: z.string().min(1, 'Prompt must not be empty'),
});

const updateJudgeSchema = z.object({
  name: z.string().min(1, 'Name must not be empty').optional(),
  prompt: z.string().min(1, 'Prompt must not be empty').optional(),
});

async function assertAdmin(userId: string): Promise<void> {
  const user = await userRepository.findById(userId);
  if (!user?.isAdmin) {
    throw new ForbiddenError('Admin access required');
  }
}

export const judgeController = {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const judges = await judgeRepository.findAll();
      res.status(200).json({ data: judges });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      await assertAdmin(userId);

      const { name, prompt } = createJudgeSchema.parse(req.body);
      const judge = await judgeRepository.create({ name, prompt });

      res.status(201).json({ data: judge });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      await assertAdmin(userId);

      const { id } = judgeIdParamSchema.parse(req.params);
      const body = updateJudgeSchema.parse(req.body);

      const existing = await judgeRepository.findById(id);
      if (!existing) {
        throw new NotFoundError('Judge not found');
      }

      const judge = await judgeRepository.update(id, body);
      res.status(200).json({ data: judge });
    } catch (err) {
      next(err);
    }
  },

  async archive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      await assertAdmin(userId);

      const { id } = judgeIdParamSchema.parse(req.params);

      const existing = await judgeRepository.findById(id);
      if (!existing) {
        throw new NotFoundError('Judge not found');
      }

      const judge = await judgeRepository.archive(id);
      res.status(200).json({ data: judge });
    } catch (err) {
      next(err);
    }
  },

  async reactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      await assertAdmin(userId);

      const { id } = judgeIdParamSchema.parse(req.params);

      const existing = await judgeRepository.findById(id);
      if (!existing) {
        throw new NotFoundError('Judge not found');
      }

      const judge = await judgeRepository.reactivate(id);
      res.status(200).json({ data: judge });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      await assertAdmin(userId);

      const { id } = judgeIdParamSchema.parse(req.params);

      const existing = await judgeRepository.findById(id);
      if (!existing) {
        throw new NotFoundError('Judge not found');
      }

      if (!existing.archivedAt) {
        res.status(400).json({ error: 'Judge must be archived before permanent deletion' });
        return;
      }

      await judgeRepository.delete(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};

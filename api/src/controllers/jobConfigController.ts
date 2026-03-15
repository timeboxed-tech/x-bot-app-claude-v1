import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { jobConfigRepository } from '../repositories/jobConfigRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { uuidSchema } from '../utils/validation.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

const idParamSchema = z.object({
  id: uuidSchema,
});

const updateJobConfigSchema = z.object({
  intervalMs: z.number().int().min(1000, 'Interval must be at least 1000ms').optional(),
  enabled: z.boolean().optional(),
});

async function assertAdmin(userId: string): Promise<void> {
  const user = await userRepository.findById(userId);
  if (!user?.isAdmin) {
    throw new ForbiddenError('Admin access required');
  }
}

export const jobConfigController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      await assertAdmin(userId);

      const configs = await jobConfigRepository.findAll();
      res.status(200).json({ data: configs });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      await assertAdmin(userId);

      const { id } = idParamSchema.parse(req.params);
      const body = updateJobConfigSchema.parse(req.body);

      const existing = await jobConfigRepository.findAll();
      const found = existing.find((c) => c.id === id);
      if (!found) {
        throw new NotFoundError('Job config not found');
      }

      const config = await jobConfigRepository.update(id, body);
      res.status(200).json({ data: config });
    } catch (err) {
      next(err);
    }
  },
};

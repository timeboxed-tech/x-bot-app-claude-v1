import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { systemConfigRepository } from '../repositories/systemConfigRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { uuidSchema } from '../utils/validation.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

const idParamSchema = z.object({
  id: uuidSchema,
});

const updateSystemConfigSchema = z.object({
  name: z.string().min(1, 'Name must not be empty').optional(),
  value: z.string().min(1, 'Value must not be empty').optional(),
});

async function assertAdmin(userId: string): Promise<void> {
  const user = await userRepository.findById(userId);
  if (!user?.isAdmin) {
    throw new ForbiddenError('Admin access required');
  }
}

export const systemConfigController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      await assertAdmin(userId);

      const configs = await systemConfigRepository.findAll();
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
      const body = updateSystemConfigSchema.parse(req.body);

      const existing = await systemConfigRepository.findAll();
      const found = existing.find((c) => c.id === id);
      if (!found) {
        throw new NotFoundError('System config not found');
      }

      const config = await systemConfigRepository.update(id, body);
      res.status(200).json({ data: config });
    } catch (err) {
      next(err);
    }
  },
};

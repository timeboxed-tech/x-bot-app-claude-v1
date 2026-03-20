import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { jobConfigRepository } from '../repositories/jobConfigRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { uuidSchema } from '../utils/validation.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';
import { invalidateJobConfigCache } from '../worker/jobDispatcher.js';

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
      invalidateJobConfigCache(found.jobType);

      // Reschedule pending jobs of this type to match new interval
      if (body.intervalMs !== undefined && config.lastRunAt) {
        const newScheduledAt = new Date(new Date(config.lastRunAt).getTime() + body.intervalMs);
        // If the new scheduled time is in the past, schedule for 1 minute from now
        const effectiveScheduledAt =
          newScheduledAt <= new Date() ? new Date(Date.now() + 60 * 1000) : newScheduledAt;

        await prisma.job.updateMany({
          where: {
            type: found.jobType,
            status: 'pending',
          },
          data: { scheduledAt: effectiveScheduledAt },
        });
      }

      res.status(200).json({ data: config });
    } catch (err) {
      next(err);
    }
  },
};

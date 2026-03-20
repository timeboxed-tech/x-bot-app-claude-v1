import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { userRepository } from '../repositories/userRepository.js';
import { ForbiddenError } from '../utils/errors.js';

const querySchema = z.object({
  provider: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

async function assertAdmin(userId: string): Promise<void> {
  const user = await userRepository.findById(userId);
  if (!user?.isAdmin) {
    throw new ForbiddenError('Admin access required');
  }
}

export const apiLogController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await assertAdmin(req.userId!);
      const { provider, page, pageSize } = querySchema.parse(req.query);

      const where = provider ? { provider } : {};
      const [logs, total] = await Promise.all([
        prisma.apiLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            provider: true,
            method: true,
            url: true,
            responseStatus: true,
            durationMs: true,
            error: true,
            createdAt: true,
          },
        }),
        prisma.apiLog.count({ where }),
      ]);

      res.json({ data: logs, meta: { page, pageSize, total } });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await assertAdmin(req.userId!);
      const id = req.params.id as string;

      const log = await prisma.apiLog.findUnique({ where: { id } });
      if (!log) {
        res.status(404).json({ error: 'Log not found' });
        return;
      }

      res.json({ data: log });
    } catch (err) {
      next(err);
    }
  },
};

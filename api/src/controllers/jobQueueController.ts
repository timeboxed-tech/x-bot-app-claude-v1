import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';
import { jobRepository } from '../repositories/jobRepository.js';
import { getEntries as getActivityLog } from '../worker/activityLog.js';
import { log } from '../worker/activityLog.js';

export const jobQueueController = {
  async cancelJob(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const job = await prisma.job.findUnique({ where: { id } });

      if (!job) {
        res.status(404).json({ error: 'Job not found or not cancellable' });
        return;
      }

      const result = await jobRepository.cancel(id);

      if (result.count === 0) {
        res.status(404).json({ error: 'Job not found or not cancellable' });
        return;
      }

      log('dispatcher', `Job ${id} cancelled by user`);
      res.status(200).json({ data: { id, status: 'cancelled' } });
    } catch (err) {
      next(err);
    }
  },

  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [jobCountsByStatus, lastCompletedByType, nextPendingByType, recentJobs, recentErrors] =
        await Promise.all([
          jobRepository.getCountsByStatusSince(twentyFourHoursAgo),
          jobRepository.getLastCompletedByType(),
          jobRepository.getNextPendingByType(),
          prisma.job.findMany({
            where: { completedAt: { not: null }, createdAt: { gte: twentyFourHoursAgo } },
            orderBy: { completedAt: 'desc' },
            take: 20,
          }),
          prisma.job.findMany({
            where: { status: 'failed', createdAt: { gte: twentyFourHoursAgo } },
            orderBy: { completedAt: 'desc' },
            take: 10,
          }),
        ]);

      const jobCounts: Record<string, number> = {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      };
      for (const row of jobCountsByStatus) {
        jobCounts[row.status] = row._count.status;
      }

      const formatJob = (job: {
        id: string;
        type: string;
        botId: string | null;
        status: string;
        scheduledAt: Date;
        startedAt: Date | null;
        completedAt: Date | null;
        error: string | null;
        createdAt: Date;
      }) => ({
        id: job.id,
        type: job.type,
        botId: job.botId,
        status: job.status,
        scheduledAt: job.scheduledAt,
        ...(job.startedAt && { startedAt: job.startedAt }),
        ...(job.completedAt && { completedAt: job.completedAt }),
        error: job.error ?? null,
        createdAt: job.createdAt,
      });

      res.status(200).json({
        data: {
          jobCounts,
          lastCompletedByType,
          nextPendingByType,
          recentJobs: recentJobs.map(formatJob),
          recentErrors: recentErrors.map(formatJob),
          activityLog: getActivityLog(),
        },
      });
    } catch (err) {
      next(err);
    }
  },
};

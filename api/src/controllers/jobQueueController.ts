import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';

export const jobQueueController = {
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const [
        jobCountsByStatus,
        postCountsByStatus,
        recentJobs,
        upcomingJobs,
        recentErrors,
        lastCompleted,
        nextScheduled,
      ] = await Promise.all([
        prisma.job.groupBy({
          by: ['status'],
          _count: { status: true },
        }),
        prisma.post.groupBy({
          by: ['status'],
          _count: { status: true },
        }),
        prisma.job.findMany({
          where: { completedAt: { not: null } },
          orderBy: { completedAt: 'desc' },
          take: 10,
          include: { bot: { select: { xAccountHandle: true } } },
        }),
        prisma.job.findMany({
          where: { status: 'pending' },
          orderBy: { scheduledAt: 'asc' },
          take: 10,
          include: { bot: { select: { xAccountHandle: true } } },
        }),
        prisma.job.findMany({
          where: { status: 'failed' },
          orderBy: { completedAt: 'desc' },
          take: 10,
          include: { bot: { select: { xAccountHandle: true } } },
        }),
        prisma.job.findFirst({
          where: { completedAt: { not: null } },
          orderBy: { completedAt: 'desc' },
          select: { completedAt: true },
        }),
        prisma.job.findFirst({
          where: { status: 'pending' },
          orderBy: { scheduledAt: 'asc' },
          select: { scheduledAt: true },
        }),
      ]);

      const jobCounts: Record<string, number> = {
        pending: 0,
        locked: 0,
        completed: 0,
        failed: 0,
      };
      for (const row of jobCountsByStatus) {
        jobCounts[row.status] = row._count.status;
      }

      const postCounts: Record<string, number> = {
        draft: 0,
        scheduled: 0,
        published: 0,
        discarded: 0,
      };
      for (const row of postCountsByStatus) {
        postCounts[row.status] = row._count.status;
      }

      const formatJob = (job: {
        id: string;
        botId: string;
        status: string;
        scheduledAt: Date;
        startedAt: Date | null;
        completedAt: Date | null;
        error: string | null;
        createdAt: Date;
        bot: { xAccountHandle: string };
      }) => ({
        id: job.id,
        botId: job.botId,
        botHandle: job.bot.xAccountHandle ? `@${job.bot.xAccountHandle}` : '',
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
          postCounts,
          recentJobs: recentJobs.map(formatJob),
          upcomingJobs: upcomingJobs.map(formatJob),
          recentErrors: recentErrors.map(formatJob),
          lastCompletedAt: lastCompleted?.completedAt ?? null,
          nextScheduledAt: nextScheduled?.scheduledAt ?? null,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};

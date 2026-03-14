import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma.js';
import { jobRepository } from '../repositories/jobRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { getEntries as getActivityLog } from '../worker/activityLog.js';
import { log } from '../worker/activityLog.js';

export const jobQueueController = {
  async cancelJob(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      // Verify the job belongs to a bot the user owns/shares, or user is admin
      const job = await prisma.job.findUnique({
        where: { id },
        include: { bot: { include: { shares: true } } },
      });

      if (!job) {
        res.status(404).json({ error: 'Job not found or not cancellable' });
        return;
      }

      const user = await userRepository.findById(userId);
      const isOwnerOrShared =
        job.bot.userId === userId ||
        job.bot.shares.some((s) => s.userId === userId);

      if (!isOwnerOrShared && !user?.isAdmin) {
        res.status(403).json({ error: 'You do not have access to this job' });
        return;
      }

      const result = await jobRepository.cancel(id);

      if (result.count === 0) {
        res.status(404).json({ error: 'Job not found or not cancellable' });
        return;
      }

      log('jobWorker', `Job ${id} cancelled by user`);
      res.status(200).json({ data: { id, status: 'cancelled' } });
    } catch (err) {
      next(err);
    }
  },

  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;

      // Determine if we should scope to user's bots
      let botFilter: Record<string, unknown> | undefined;
      const showAll = req.query.showAll === 'true';
      if (showAll) {
        const user = await userRepository.findById(userId);
        if (!user?.isAdmin) {
          // Non-admin: ignore showAll, scope to their bots
          botFilter = { bot: { OR: [{ userId }, { shares: { some: { userId } } }] } };
        }
        // Admin with showAll: no filter
      } else {
        botFilter = { bot: { OR: [{ userId }, { shares: { some: { userId } } }] } };
      }

      const jobWhere = botFilter ?? {};
      const postWhere = botFilter ?? {};

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
          ...(botFilter ? { where: jobWhere } : {}),
        }),
        prisma.post.groupBy({
          by: ['status'],
          _count: { status: true },
          ...(botFilter ? { where: postWhere } : {}),
        }),
        prisma.job.findMany({
          where: { completedAt: { not: null }, ...jobWhere },
          orderBy: { completedAt: 'desc' },
          take: 10,
          include: { bot: { select: { xAccountHandle: true } } },
        }),
        prisma.job.findMany({
          where: { status: 'pending', ...jobWhere },
          orderBy: { scheduledAt: 'asc' },
          take: 10,
          include: { bot: { select: { xAccountHandle: true } } },
        }),
        prisma.job.findMany({
          where: { status: 'failed', ...jobWhere },
          orderBy: { completedAt: 'desc' },
          take: 10,
          include: { bot: { select: { xAccountHandle: true } } },
        }),
        prisma.job.findFirst({
          where: { completedAt: { not: null }, ...jobWhere },
          orderBy: { completedAt: 'desc' },
          select: { completedAt: true },
        }),
        prisma.job.findFirst({
          where: { status: 'pending', ...jobWhere },
          orderBy: { scheduledAt: 'asc' },
          select: { scheduledAt: true },
        }),
      ]);

      const jobCounts: Record<string, number> = {
        pending: 0,
        locked: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
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
          activityLog: getActivityLog(),
        },
      });
    } catch (err) {
      next(err);
    }
  },
};

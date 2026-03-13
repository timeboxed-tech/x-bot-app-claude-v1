import { prisma } from '../utils/prisma.js';
import type { PrismaClient } from '@prisma/client';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

type JobRow = {
  id: string;
  botId: string;
  status: string;
  lockToken: string | null;
  lockedAt: Date | null;
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

export const jobRepository = {
  async createInTransaction(
    tx: TransactionClient,
    data: { botId: string; scheduledAt: Date; status?: string },
  ) {
    return tx.job.create({
      data: {
        botId: data.botId,
        scheduledAt: data.scheduledAt,
        status: data.status || 'pending',
      },
    });
  },

  async create(data: { botId: string; scheduledAt: Date; status?: string }) {
    return prisma.job.create({
      data: {
        botId: data.botId,
        scheduledAt: data.scheduledAt,
        status: data.status || 'pending',
      },
    });
  },

  async findPendingJobs(limit = 10) {
    return prisma.job.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: new Date() },
        bot: { active: true, user: { archivedAt: null } },
      },
      include: { bot: true },
      take: limit,
      orderBy: { scheduledAt: 'asc' },
    });
  },

  /**
   * Atomic claim using SELECT ... FOR UPDATE SKIP LOCKED.
   * Returns the claimed job or null if no job was available.
   */
  async claimJob(jobId: string, lockToken: string): Promise<JobRow | null> {
    const now = new Date();
    const result = await prisma.$queryRaw<JobRow[]>`
      UPDATE "Job"
      SET status = 'locked',
          "lockToken" = ${lockToken}::uuid,
          "lockedAt" = ${now},
          "startedAt" = ${now}
      WHERE id = (
        SELECT id FROM "Job"
        WHERE id = ${jobId}::uuid
          AND status = 'pending'
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `;
    return result.length > 0 ? result[0] : null;
  },

  async markCompleted(jobId: string) {
    return prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });
  },

  async markFailed(jobId: string) {
    return prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
      },
    });
  },

  async findStaleLockedJobs(staleMinutes = 10) {
    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
    return prisma.job.findMany({
      where: {
        status: 'locked',
        lockedAt: { lt: cutoff },
      },
    });
  },

  async resetStaleLocks(staleMinutes = 10) {
    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
    return prisma.job.updateMany({
      where: {
        status: 'locked',
        lockedAt: { lt: cutoff },
      },
      data: {
        status: 'pending',
        lockToken: null,
        lockedAt: null,
      },
    });
  },
};

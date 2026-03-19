import { prisma } from '../utils/prisma.js';
import type { PrismaClient } from '../generated/prisma/client.js';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

type JobRow = {
  id: string;
  type: string;
  botId: string | null;
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
    data: {
      type: string;
      botId?: string;
      scheduledAt: Date;
      status?: string;
      payload?: string | null;
      idempotencyKey?: string | null;
    },
  ) {
    return tx.job.create({
      data: {
        type: data.type,
        botId: data.botId ?? null,
        scheduledAt: data.scheduledAt,
        status: data.status || 'pending',
        payload: data.payload ?? null,
        idempotencyKey: data.idempotencyKey ?? null,
      },
    });
  },

  async create(data: {
    type: string;
    botId?: string | null;
    scheduledAt: Date;
    status?: string;
    payload?: string | null;
    idempotencyKey?: string | null;
  }) {
    return prisma.job.create({
      data: {
        type: data.type,
        botId: data.botId ?? null,
        scheduledAt: data.scheduledAt,
        status: data.status || 'pending',
        payload: data.payload ?? null,
        idempotencyKey: data.idempotencyKey ?? null,
      },
    });
  },

  async findPendingJobs(limit = 10) {
    return prisma.job.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: new Date() },
      },
      include: { bot: true },
      take: limit,
      orderBy: { scheduledAt: 'asc' },
    });
  },

  async findPendingJobsByType(type: string, limit = 1) {
    return prisma.job.findMany({
      where: {
        type,
        status: 'pending',
        scheduledAt: { lte: new Date() },
      },
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
      SET status = 'running',
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

  async markFailed(jobId: string, error?: string) {
    return prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: error ?? null,
      },
    });
  },

  async cancel(jobId: string) {
    return prisma.job.updateMany({
      where: {
        id: jobId,
        status: { in: ['pending', 'running'] },
      },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    });
  },

  async findStaleRunningJobs(staleMinutes = 10) {
    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
    return prisma.job.findMany({
      where: {
        status: 'running',
        lockedAt: { lt: cutoff },
      },
    });
  },

  async resetStaleRunning(staleMinutes = 10) {
    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
    return prisma.job.updateMany({
      where: {
        status: 'running',
        lockedAt: { lt: cutoff },
      },
      data: {
        status: 'pending',
        lockToken: null,
        lockedAt: null,
      },
    });
  },

  async hasPendingOrRunning(type: string) {
    const count = await prisma.job.count({
      where: {
        type,
        status: { in: ['pending', 'running'] },
      },
    });
    return count > 0;
  },

  async ensureJobExists(type: string, scheduledAt: Date) {
    const exists = await this.hasPendingOrRunning(type);
    if (!exists) {
      await this.create({ type, scheduledAt, status: 'pending' });
    }
  },

  async deleteOldJobs(olderThanDays = 7) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    return prisma.job.deleteMany({
      where: {
        status: { notIn: ['pending', 'running'] },
        createdAt: { lt: cutoff },
      },
    });
  },

  async getCountsByStatusSince(since: Date) {
    return prisma.job.groupBy({
      by: ['status'],
      _count: { status: true },
      where: { createdAt: { gte: since } },
    });
  },

  async getLastCompletedByType() {
    const types = ['post-generator', 'post-approver', 'post-publish', 'cleanup'] as const;
    const results: Record<string, Date | null> = {};
    for (const type of types) {
      const job = await prisma.job.findFirst({
        where: { type, status: 'completed' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      });
      results[type] = job?.completedAt ?? null;
    }
    return results;
  },

  async getNextPendingByType() {
    const types = ['post-generator', 'post-approver', 'post-publish', 'cleanup'] as const;
    const results: Record<string, Date | null> = {};
    for (const type of types) {
      const job = await prisma.job.findFirst({
        where: { type, status: 'pending' },
        orderBy: { scheduledAt: 'asc' },
        select: { scheduledAt: true },
      });
      results[type] = job?.scheduledAt ?? null;
    }
    return results;
  },
};

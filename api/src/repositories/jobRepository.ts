import { prisma } from '../utils/prisma.js';
import type { PrismaClient } from '@prisma/client';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

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
};

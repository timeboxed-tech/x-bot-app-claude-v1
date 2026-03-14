import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';

type TxClient = Prisma.TransactionClient;

export const judgeRepository = {
  async findAll() {
    return prisma.judge.findMany({
      orderBy: { createdAt: 'asc' },
    });
  },

  async findById(id: string) {
    return prisma.judge.findUnique({
      where: { id },
    });
  },

  async create(data: { name: string; prompt: string }) {
    return prisma.judge.create({
      data: {
        name: data.name,
        prompt: data.prompt,
      },
    });
  },

  async update(id: string, data: { name?: string; prompt?: string }) {
    return prisma.judge.update({
      where: { id },
      data,
    });
  },

  async archive(id: string) {
    return prisma.judge.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  },

  async reactivate(id: string) {
    return prisma.judge.update({
      where: { id },
      data: { archivedAt: null },
    });
  },

  async delete(id: string) {
    return prisma.$transaction(async (tx: TxClient) => {
      await tx.botJudge.deleteMany({ where: { judgeId: id } });
      await tx.postReview.deleteMany({ where: { judgeId: id } });
      return tx.judge.delete({ where: { id } });
    });
  },
};

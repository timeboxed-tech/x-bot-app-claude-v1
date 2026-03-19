import { prisma } from '../utils/prisma.js';

export const jobConfigRepository = {
  async findAll() {
    return prisma.jobConfig.findMany({
      orderBy: { jobType: 'asc' },
    });
  },

  async findByJobType(jobType: string) {
    return prisma.jobConfig.findUnique({
      where: { jobType },
    });
  },

  async update(id: string, data: { intervalMs?: number; enabled?: boolean }) {
    return prisma.jobConfig.update({
      where: { id },
      data,
    });
  },

  async updateLastRunAt(jobType: string) {
    return prisma.jobConfig.update({
      where: { jobType },
      data: { lastRunAt: new Date() },
    });
  },
};

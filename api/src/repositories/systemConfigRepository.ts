import { prisma } from '../utils/prisma.js';

export const systemConfigRepository = {
  async findAll() {
    return prisma.systemConfig.findMany({
      orderBy: { name: 'asc' },
    });
  },

  async findByKey(key: string) {
    return prisma.systemConfig.findUnique({
      where: { key },
    });
  },

  async update(id: string, data: { name?: string; value?: string }) {
    return prisma.systemConfig.update({
      where: { id },
      data,
    });
  },
};

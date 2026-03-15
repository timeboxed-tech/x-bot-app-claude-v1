import { prisma } from '../utils/prisma.js';

export const systemPromptRepository = {
  async findAll() {
    return prisma.systemPrompt.findMany({
      orderBy: { name: 'asc' },
    });
  },

  async findByKey(key: string) {
    return prisma.systemPrompt.findUnique({
      where: { key },
    });
  },

  async update(id: string, data: { name?: string; content?: string }) {
    return prisma.systemPrompt.update({
      where: { id },
      data,
    });
  },
};

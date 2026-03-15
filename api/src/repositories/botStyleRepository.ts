import { prisma } from '../utils/prisma.js';

export const botStyleRepository = {
  async findByBotId(botId: string) {
    return prisma.botStyle.findMany({
      where: { botId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findActiveByBotId(botId: string) {
    return prisma.botStyle.findMany({
      where: { botId, active: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: string) {
    return prisma.botStyle.findUnique({
      where: { id },
    });
  },

  async create(botId: string, content: string, active?: boolean) {
    return prisma.botStyle.create({
      data: { botId, content, ...(active !== undefined ? { active } : {}) },
    });
  },

  async update(id: string, content: string) {
    return prisma.botStyle.update({
      where: { id },
      data: { content },
    });
  },

  async delete(id: string) {
    return prisma.botStyle.delete({
      where: { id },
    });
  },

  async countByBotId(botId: string) {
    return prisma.botStyle.count({ where: { botId } });
  },

  async toggleActive(id: string, active: boolean) {
    return prisma.botStyle.update({
      where: { id },
      data: { active },
    });
  },
};

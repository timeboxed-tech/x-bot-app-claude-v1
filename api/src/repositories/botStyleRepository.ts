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

  async create(
    botId: string,
    content: string,
    active?: boolean,
    title?: string,
    knowledgeSource?: string,
  ) {
    return prisma.botStyle.create({
      data: {
        botId,
        content,
        title: title ?? '',
        ...(active !== undefined ? { active } : {}),
        ...(knowledgeSource !== undefined ? { knowledgeSource } : {}),
      },
    });
  },

  async update(id: string, content: string, title?: string, knowledgeSource?: string) {
    return prisma.botStyle.update({
      where: { id },
      data: {
        content,
        ...(title !== undefined ? { title } : {}),
        ...(knowledgeSource !== undefined ? { knowledgeSource } : {}),
      },
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

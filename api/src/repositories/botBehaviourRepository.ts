import { prisma } from '../utils/prisma.js';

export const botBehaviourRepository = {
  async findByBotId(botId: string) {
    return prisma.botBehaviour.findMany({
      where: { botId },
      orderBy: { title: 'asc' },
    });
  },

  async findActiveByBotId(botId: string) {
    return prisma.botBehaviour.findMany({
      where: { botId, active: true },
      orderBy: { title: 'asc' },
    });
  },

  async findById(id: string) {
    return prisma.botBehaviour.findUnique({
      where: { id },
    });
  },

  async create(
    botId: string,
    content: string,
    active?: boolean,
    title?: string,
    knowledgeSource?: string,
    outcome?: string,
    queryPrompt?: string,
    weight?: number,
  ) {
    return prisma.botBehaviour.create({
      data: {
        botId,
        content,
        title: title ?? '',
        ...(active !== undefined ? { active } : {}),
        ...(knowledgeSource !== undefined ? { knowledgeSource } : {}),
        ...(outcome !== undefined ? { outcome } : {}),
        ...(queryPrompt !== undefined ? { queryPrompt } : {}),
        ...(weight !== undefined ? { weight } : {}),
      },
    });
  },

  async update(
    id: string,
    content: string,
    title?: string,
    knowledgeSource?: string,
    outcome?: string,
    queryPrompt?: string,
    weight?: number,
  ) {
    return prisma.botBehaviour.update({
      where: { id },
      data: {
        content,
        ...(title !== undefined ? { title } : {}),
        ...(knowledgeSource !== undefined ? { knowledgeSource } : {}),
        ...(outcome !== undefined ? { outcome } : {}),
        ...(queryPrompt !== undefined ? { queryPrompt } : {}),
        ...(weight !== undefined ? { weight } : {}),
      },
    });
  },

  async delete(id: string) {
    return prisma.botBehaviour.delete({
      where: { id },
    });
  },

  async countByBotId(botId: string) {
    return prisma.botBehaviour.count({ where: { botId } });
  },

  async toggleActive(id: string, active: boolean) {
    return prisma.botBehaviour.update({
      where: { id },
      data: { active },
    });
  },
};

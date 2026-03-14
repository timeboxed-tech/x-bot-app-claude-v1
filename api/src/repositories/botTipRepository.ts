import { prisma } from '../utils/prisma.js';

export const botTipRepository = {
  async create(data: { botId: string; content: string }) {
    return prisma.botTip.create({
      data: {
        botId: data.botId,
        content: data.content,
      },
    });
  },

  async createMany(tips: Array<{ botId: string; content: string }>) {
    const created = await Promise.all(
      tips.map((tip) =>
        prisma.botTip.create({
          data: {
            botId: tip.botId,
            content: tip.content,
          },
        }),
      ),
    );
    return created;
  },

  async countByBotId(botId: string) {
    return prisma.botTip.count({ where: { botId } });
  },

  async findByBotId(botId: string) {
    return prisma.botTip.findMany({
      where: { botId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: string) {
    return prisma.botTip.findUnique({
      where: { id },
    });
  },

  async update(id: string, content: string) {
    return prisma.botTip.update({
      where: { id },
      data: { content },
    });
  },

  async delete(id: string) {
    return prisma.botTip.delete({
      where: { id },
    });
  },
};

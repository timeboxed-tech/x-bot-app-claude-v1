import { prisma } from '../utils/prisma.js';

type CreateBotInput = {
  userId: string;
  xAccessToken: string;
  xAccessSecret: string;
  xAccountHandle: string;
  prompt: string;
  postMode: string;
  postsPerDay: number;
  minIntervalHours: number;
  preferredHoursStart: number;
  preferredHoursEnd: number;
  knowledgeSource: string;
  judgeKnowledgeSource: string;
  active: boolean;
};

type UpdateBotInput = Partial<
  Omit<CreateBotInput, 'userId' | 'xAccessToken' | 'xAccessSecret' | 'xAccountHandle'>
> & {
  xAccessToken?: string;
  xAccessSecret?: string;
  xAccountHandle?: string;
};

const botSelect = {
  id: true,
  userId: true,
  platform: true,
  xAccountHandle: true,
  prompt: true,
  postMode: true,
  postsPerDay: true,
  minIntervalHours: true,
  preferredHoursStart: true,
  preferredHoursEnd: true,
  knowledgeSource: true,
  judgeKnowledgeSource: true,
  active: true,
  createdAt: true,
};

export const botRepository = {
  async create(data: CreateBotInput) {
    return prisma.bot.create({
      data,
      select: botSelect,
    });
  },

  async findById(id: string) {
    return prisma.bot.findUnique({
      where: { id },
      select: botSelect,
    });
  },

  async findByUserId(userId: string, page: number, pageSize: number) {
    const where = {
      OR: [{ userId }, { shares: { some: { userId } } }],
    };
    const [bots, total] = await Promise.all([
      prisma.bot.findMany({
        where,
        select: {
          ...botSelect,
          user: { select: { id: true, email: true, name: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bot.count({ where }),
    ]);
    return { bots, total };
  },

  async update(id: string, data: UpdateBotInput) {
    return prisma.bot.update({
      where: { id },
      data,
      select: botSelect,
    });
  },
};

import { prisma } from '../utils/prisma.js';
import { botRepository } from '../repositories/botRepository.js';
import { jobRepository } from '../repositories/jobRepository.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

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
};

type UpdateBotInput = {
  prompt?: string;
  postMode?: string;
  postsPerDay?: number;
  minIntervalHours?: number;
  preferredHoursStart?: number;
  preferredHoursEnd?: number;
  active?: boolean;
  xAccessToken?: string;
  xAccessSecret?: string;
  xAccountHandle?: string;
};

export const botService = {
  async createBot(input: CreateBotInput) {
    const result = await prisma.$transaction(async (tx) => {
      const bot = await tx.bot.create({
        data: {
          ...input,
          active: true,
        },
        select: {
          id: true,
          userId: true,
          xAccountHandle: true,
          prompt: true,
          postMode: true,
          postsPerDay: true,
          minIntervalHours: true,
          preferredHoursStart: true,
          preferredHoursEnd: true,
          active: true,
          createdAt: true,
        },
      });

      await jobRepository.createInTransaction(tx, {
        botId: bot.id,
        scheduledAt: new Date(),
        status: 'pending',
      });

      return bot;
    });

    return result;
  },

  async listBots(userId: string, page: number, pageSize: number) {
    return botRepository.findByUserId(userId, page, pageSize);
  },

  async getBot(botId: string, userId: string) {
    const bot = await botRepository.findById(botId);
    if (!bot) {
      throw new NotFoundError('Bot not found');
    }
    if (bot.userId !== userId) {
      throw new ForbiddenError('You do not have access to this bot');
    }
    return bot;
  },

  async updateBot(botId: string, userId: string, input: UpdateBotInput) {
    const bot = await botRepository.findById(botId);
    if (!bot) {
      throw new NotFoundError('Bot not found');
    }
    if (bot.userId !== userId) {
      throw new ForbiddenError('You do not have access to this bot');
    }
    return botRepository.update(botId, input);
  },
};

import { prisma } from '../utils/prisma.js';
import { botRepository } from '../repositories/botRepository.js';
import { botShareRepository } from '../repositories/botShareRepository.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

type CreateBotInput = {
  userId: string;
  platform?: string;
  prompt: string;
  postMode: string;
  postsPerDay: number;
  minIntervalHours: number;
  preferredHoursStart: number;
  preferredHoursEnd: number;
  knowledgeSource?: string;
  judgeKnowledgeSource?: string;
};

type UpdateBotInput = {
  prompt?: string;
  postMode?: string;
  postsPerDay?: number;
  minIntervalHours?: number;
  preferredHoursStart?: number;
  preferredHoursEnd?: number;
  knowledgeSource?: string;
  judgeKnowledgeSource?: string;
  active?: boolean;
  xAccessToken?: string;
  xAccessSecret?: string;
  xAccountHandle?: string;
};

export const botService = {
  async createBot(input: CreateBotInput) {
    return prisma.bot.create({
      data: {
        ...input,
        active: true,
      },
      select: {
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
      },
    });
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
      const share = await botShareRepository.findByBotIdAndUserId(botId, userId);
      if (!share) {
        throw new ForbiddenError('You do not have access to this bot');
      }
    }
    return bot;
  },

  async updateBot(botId: string, userId: string, input: UpdateBotInput) {
    const bot = await botRepository.findById(botId);
    if (!bot) {
      throw new NotFoundError('Bot not found');
    }
    if (bot.userId !== userId) {
      const share = await botShareRepository.findByBotIdAndUserId(botId, userId);
      if (!share) {
        throw new ForbiddenError('You do not have access to this bot');
      }
    }
    return botRepository.update(botId, input);
  },
};

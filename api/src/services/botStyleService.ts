import { botStyleRepository } from '../repositories/botStyleRepository.js';
import { botRepository } from '../repositories/botRepository.js';
import { botShareRepository } from '../repositories/botShareRepository.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

const MAX_STYLES_PER_BOT = 5;

async function assertBotAccess(botId: string, userId: string): Promise<void> {
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
}

export const botStyleService = {
  async list(botId: string, userId: string) {
    await assertBotAccess(botId, userId);
    return botStyleRepository.findByBotId(botId);
  },

  async create(botId: string, userId: string, content: string) {
    await assertBotAccess(botId, userId);

    const count = await botStyleRepository.countByBotId(botId);
    if (count >= MAX_STYLES_PER_BOT) {
      throw new ValidationError(`Maximum of ${MAX_STYLES_PER_BOT} styles per bot`);
    }

    return botStyleRepository.create(botId, content);
  },

  async update(botId: string, styleId: string, userId: string, content: string) {
    await assertBotAccess(botId, userId);

    const style = await botStyleRepository.findById(styleId);
    if (!style || style.botId !== botId) {
      throw new NotFoundError('Style not found');
    }

    return botStyleRepository.update(styleId, content);
  },

  async remove(botId: string, styleId: string, userId: string) {
    await assertBotAccess(botId, userId);

    const style = await botStyleRepository.findById(styleId);
    if (!style || style.botId !== botId) {
      throw new NotFoundError('Style not found');
    }

    await botStyleRepository.delete(styleId);
  },

  async toggleActive(botId: string, styleId: string, userId: string, active: boolean) {
    await assertBotAccess(botId, userId);

    const style = await botStyleRepository.findById(styleId);
    if (!style || style.botId !== botId) {
      throw new NotFoundError('Style not found');
    }

    return botStyleRepository.toggleActive(styleId, active);
  },
};

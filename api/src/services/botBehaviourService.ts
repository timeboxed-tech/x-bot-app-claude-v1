import { botBehaviourRepository } from '../repositories/botBehaviourRepository.js';
import { botRepository } from '../repositories/botRepository.js';
import { botShareRepository } from '../repositories/botShareRepository.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

const MAX_BEHAVIOURS_PER_BOT = 5;

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

export const botBehaviourService = {
  async list(botId: string, userId: string) {
    await assertBotAccess(botId, userId);
    return botBehaviourRepository.findByBotId(botId);
  },

  async create(
    botId: string,
    userId: string,
    content: string,
    title?: string,
    knowledgeSource?: string,
    weight?: number,
  ) {
    await assertBotAccess(botId, userId);

    const count = await botBehaviourRepository.countByBotId(botId);
    if (count >= MAX_BEHAVIOURS_PER_BOT) {
      throw new ValidationError(`Maximum of ${MAX_BEHAVIOURS_PER_BOT} behaviours per bot`);
    }

    return botBehaviourRepository.create(botId, content, undefined, title, knowledgeSource, weight);
  },

  async update(
    botId: string,
    behaviourId: string,
    userId: string,
    content: string,
    title?: string,
    knowledgeSource?: string,
    weight?: number,
  ) {
    await assertBotAccess(botId, userId);

    const behaviour = await botBehaviourRepository.findById(behaviourId);
    if (!behaviour || behaviour.botId !== botId) {
      throw new NotFoundError('Behaviour not found');
    }

    return botBehaviourRepository.update(behaviourId, content, title, knowledgeSource, weight);
  },

  async remove(botId: string, behaviourId: string, userId: string) {
    await assertBotAccess(botId, userId);

    const behaviour = await botBehaviourRepository.findById(behaviourId);
    if (!behaviour || behaviour.botId !== botId) {
      throw new NotFoundError('Behaviour not found');
    }

    await botBehaviourRepository.delete(behaviourId);
  },

  async toggleActive(botId: string, behaviourId: string, userId: string, active: boolean) {
    await assertBotAccess(botId, userId);

    const behaviour = await botBehaviourRepository.findById(behaviourId);
    if (!behaviour || behaviour.botId !== botId) {
      throw new NotFoundError('Behaviour not found');
    }

    return botBehaviourRepository.toggleActive(behaviourId, active);
  },
};

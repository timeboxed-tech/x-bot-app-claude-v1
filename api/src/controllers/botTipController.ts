import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { botTipRepository } from '../repositories/botTipRepository.js';
import { botRepository } from '../repositories/botRepository.js';
import { botShareRepository } from '../repositories/botShareRepository.js';
import { uuidSchema } from '../utils/validation.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

const botIdParamSchema = z.object({
  id: uuidSchema,
});

const tipIdParamSchema = z.object({
  id: uuidSchema,
  tipId: uuidSchema,
});

const updateTipSchema = z.object({
  content: z.string().min(1, 'Content must not be empty'),
});

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

export const botTipController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = botIdParamSchema.parse(req.params);
      await assertBotAccess(id, userId);

      const tips = await botTipRepository.findByBotId(id);

      res.status(200).json({
        data: tips,
      });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id, tipId } = tipIdParamSchema.parse(req.params);
      await assertBotAccess(id, userId);

      const tip = await botTipRepository.findById(tipId);
      if (!tip || tip.botId !== id) {
        throw new NotFoundError('Tip not found');
      }

      const { content } = updateTipSchema.parse(req.body);
      const updated = await botTipRepository.update(tipId, content);

      res.status(200).json({
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id, tipId } = tipIdParamSchema.parse(req.params);
      await assertBotAccess(id, userId);

      const tip = await botTipRepository.findById(tipId);
      if (!tip || tip.botId !== id) {
        throw new NotFoundError('Tip not found');
      }

      await botTipRepository.delete(tipId);

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};

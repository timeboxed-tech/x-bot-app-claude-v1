import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { xOAuthService } from '../services/xOAuthService.js';
import { botRepository } from '../repositories/botRepository.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { config } from '../config/index.js';

const connectQuerySchema = z.object({
  botId: z.string().min(1, 'botId is required'),
});

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export const xOAuthController = {
  async connect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { botId } = connectQuerySchema.parse(req.query);

      const bot = await botRepository.findById(botId);
      if (!bot) {
        throw new NotFoundError('Bot not found');
      }
      if (bot.userId !== userId) {
        throw new ForbiddenError('You do not have access to this bot');
      }

      const authUrl = xOAuthService.generateAuthUrl(botId);

      res.status(200).json({
        data: { url: authUrl },
      });
    } catch (err) {
      next(err);
    }
  },

  async callback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state } = callbackQuerySchema.parse(req.query);

      const { accessToken, refreshToken, screenName, botId } = await xOAuthService.exchangeCode(
        code,
        state,
      );

      // Store OAuth 2.0 tokens: accessToken in xAccessToken, refreshToken in xAccessSecret
      await botRepository.update(botId, {
        xAccessToken: accessToken,
        xAccessSecret: refreshToken,
        xAccountHandle: screenName,
      });

      res.redirect(`${config.app.frontendUrl}/dashboard`);
    } catch (err) {
      next(err);
    }
  },
};

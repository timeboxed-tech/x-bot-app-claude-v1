import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { botService } from '../services/botService.js';
import { paginationSchema, uuidSchema } from '../utils/validation.js';

const createBotSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  postMode: z.enum(['auto', 'manual']).default('manual'),
  postsPerDay: z.number().int().min(1).max(15).default(3),
  minIntervalHours: z.number().int().min(1).max(15).default(2),
  preferredHoursStart: z.number().int().min(0).max(23).default(0),
  preferredHoursEnd: z.number().int().min(1).max(24).default(24),
});

const updateBotSchema = z.object({
  prompt: z.string().min(1).optional(),
  postMode: z.enum(['auto', 'manual']).optional(),
  postsPerDay: z.number().int().min(1).max(15).optional(),
  minIntervalHours: z.number().int().min(1).max(15).optional(),
  preferredHoursStart: z.number().int().min(0).max(23).optional(),
  preferredHoursEnd: z.number().int().min(1).max(24).optional(),
  active: z.boolean().optional(),
  xAccessToken: z.string().min(1).optional(),
  xAccessSecret: z.string().min(1).optional(),
  xAccountHandle: z.string().min(1).optional(),
});

const botIdParamSchema = z.object({
  id: uuidSchema,
});

export const botController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const body = createBotSchema.parse(req.body);
      const bot = await botService.createBot({ ...body, userId });

      res.status(201).json({
        data: bot,
      });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { page, pageSize } = paginationSchema.parse(req.query);
      const { bots, total } = await botService.listBots(userId, page, pageSize);

      res.status(200).json({
        data: bots,
        meta: { page, pageSize, total },
      });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = botIdParamSchema.parse(req.params);
      const bot = await botService.getBot(id, userId);

      res.status(200).json({
        data: bot,
      });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = botIdParamSchema.parse(req.params);
      const body = updateBotSchema.parse(req.body);
      const bot = await botService.updateBot(id, userId, body);

      res.status(200).json({
        data: bot,
      });
    } catch (err) {
      next(err);
    }
  },
};

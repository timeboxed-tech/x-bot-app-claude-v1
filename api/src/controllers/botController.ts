import { Request, Response } from 'express';
import { z } from 'zod';
import * as botService from '../services/botService.js';

const createBotSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  postMode: z.enum(['auto', 'manual']),
  postsPerDay: z.number().int().min(1).max(15),
  minIntervalHours: z.number().int().min(1).max(15),
  preferredHoursStart: z.number().int().min(0).max(23),
  preferredHoursEnd: z.number().int().min(1).max(24),
});

const updateBotSchema = z.object({
  prompt: z.string().min(1).optional(),
  postMode: z.enum(['auto', 'manual']).optional(),
  postsPerDay: z.number().int().min(1).max(15).optional(),
  minIntervalHours: z.number().int().min(1).max(15).optional(),
  preferredHoursStart: z.number().int().min(0).max(23).optional(),
  preferredHoursEnd: z.number().int().min(1).max(24).optional(),
  active: z.boolean().optional(),
});

export async function getMyBot(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
      return;
    }

    const bot = await botService.getBotForUser(req.user.userId);
    res.json({ data: bot });
  } catch {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bot' },
    });
  }
}

export async function createMyBot(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
      return;
    }

    const parsed = createBotSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const bot = await botService.createBot(req.user.userId, parsed.data);
    res.status(201).json({ data: bot });
  } catch {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create bot' },
    });
  }
}

export async function updateMyBot(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
      return;
    }

    const parsed = updateBotSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const botId = req.params.botId;
    if (!botId || typeof botId !== 'string') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Bot ID is required' },
      });
      return;
    }

    const bot = await botService.updateBot(botId, req.user.userId, parsed.data);
    res.json({ data: bot });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'BOT_NOT_FOUND') {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Bot not found' },
      });
      return;
    }
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update bot' },
    });
  }
}

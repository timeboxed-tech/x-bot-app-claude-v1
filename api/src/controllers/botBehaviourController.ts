import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { botBehaviourService } from '../services/botBehaviourService.js';
import { uuidSchema } from '../utils/validation.js';

const botIdParamSchema = z.object({
  id: uuidSchema,
});

const behaviourIdParamSchema = z.object({
  id: uuidSchema,
  behaviourId: uuidSchema,
});

const outcomeEnum = z.enum(['write_post', 'reply_to_post', 'like_post', 'follow_account']);

const createBehaviourSchema = z.object({
  content: z.string().min(1, 'Content must not be empty'),
  title: z.string().optional(),
  knowledgeSource: z.enum(['default', 'ai', 'ai+web']).default('default'),
  outcome: outcomeEnum.default('write_post'),
  queryPrompt: z.string().optional(),
  weight: z.number().int().min(0).max(100).optional(),
});

const updateBehaviourSchema = z.object({
  content: z.string().min(1, 'Content must not be empty'),
  title: z.string().optional(),
  knowledgeSource: z.enum(['default', 'ai', 'ai+web']).optional(),
  outcome: outcomeEnum.optional(),
  queryPrompt: z.string().optional(),
  weight: z.number().int().min(0).max(100).optional(),
});

const toggleActiveSchema = z.object({
  active: z.boolean(),
});

export const botBehaviourController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = botIdParamSchema.parse(req.params);
      const behaviours = await botBehaviourService.list(id, userId);

      res.status(200).json({
        data: behaviours,
      });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = botIdParamSchema.parse(req.params);
      const { content, title, knowledgeSource, outcome, queryPrompt, weight } =
        createBehaviourSchema.parse(req.body);
      const behaviour = await botBehaviourService.create(
        id,
        userId,
        content,
        title,
        knowledgeSource,
        outcome,
        queryPrompt,
        weight,
      );

      res.status(201).json({
        data: behaviour,
      });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id, behaviourId } = behaviourIdParamSchema.parse(req.params);
      const { content, title, knowledgeSource, outcome, queryPrompt, weight } =
        updateBehaviourSchema.parse(req.body);
      const behaviour = await botBehaviourService.update(
        id,
        behaviourId,
        userId,
        content,
        title,
        knowledgeSource,
        outcome,
        queryPrompt,
        weight,
      );

      res.status(200).json({
        data: behaviour,
      });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id, behaviourId } = behaviourIdParamSchema.parse(req.params);
      await botBehaviourService.remove(id, behaviourId, userId);

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async toggleActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id, behaviourId } = behaviourIdParamSchema.parse(req.params);
      const { active } = toggleActiveSchema.parse(req.body);
      const behaviour = await botBehaviourService.toggleActive(id, behaviourId, userId, active);

      res.status(200).json({
        data: behaviour,
      });
    } catch (err) {
      next(err);
    }
  },
};

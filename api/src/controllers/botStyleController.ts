import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { botStyleService } from '../services/botStyleService.js';
import { uuidSchema } from '../utils/validation.js';

const botIdParamSchema = z.object({
  id: uuidSchema,
});

const styleIdParamSchema = z.object({
  id: uuidSchema,
  styleId: uuidSchema,
});

const createStyleSchema = z.object({
  content: z.string().min(1, 'Content must not be empty'),
  title: z.string().optional(),
  knowledgeSource: z.enum(['default', 'ai', 'ai+web']).default('default'),
});

const updateStyleSchema = z.object({
  content: z.string().min(1, 'Content must not be empty'),
  title: z.string().optional(),
  knowledgeSource: z.enum(['default', 'ai', 'ai+web']).optional(),
});

const toggleActiveSchema = z.object({
  active: z.boolean(),
});

export const botStyleController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = botIdParamSchema.parse(req.params);
      const styles = await botStyleService.list(id, userId);

      res.status(200).json({
        data: styles,
      });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = botIdParamSchema.parse(req.params);
      const { content, title, knowledgeSource } = createStyleSchema.parse(req.body);
      const style = await botStyleService.create(id, userId, content, title, knowledgeSource);

      res.status(201).json({
        data: style,
      });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id, styleId } = styleIdParamSchema.parse(req.params);
      const { content, title, knowledgeSource } = updateStyleSchema.parse(req.body);
      const style = await botStyleService.update(
        id,
        styleId,
        userId,
        content,
        title,
        knowledgeSource,
      );

      res.status(200).json({
        data: style,
      });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id, styleId } = styleIdParamSchema.parse(req.params);
      await botStyleService.remove(id, styleId, userId);

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async toggleActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id, styleId } = styleIdParamSchema.parse(req.params);
      const { active } = toggleActiveSchema.parse(req.body);
      const style = await botStyleService.toggleActive(id, styleId, userId, active);

      res.status(200).json({
        data: style,
      });
    } catch (err) {
      next(err);
    }
  },
};

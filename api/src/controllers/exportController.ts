import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { systemPromptRepository } from '../repositories/systemPromptRepository.js';
import { judgeRepository } from '../repositories/judgeRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { prisma } from '../utils/prisma.js';
import { ForbiddenError } from '../utils/errors.js';

const formatSchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
});

async function assertAdmin(userId: string): Promise<void> {
  const user = await userRepository.findById(userId);
  if (!user?.isAdmin) {
    throw new ForbiddenError('Admin access required');
  }
}

function escapeCsvField(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCsvField).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(','));
  return [headerLine, ...dataLines].join('\n');
}

function setDownloadHeaders(res: Response, filename: string, format: string): void {
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
  }
}

export const exportController = {
  async systemPrompts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      await assertAdmin(userId);

      const { format } = formatSchema.parse(req.query);
      const prompts = await systemPromptRepository.findAll();

      setDownloadHeaders(res, 'system-prompts', format);

      if (format === 'csv') {
        const headers = ['id', 'key', 'name', 'content', 'createdAt', 'updatedAt'];
        const rows = prompts.map((p) => [p.id, p.key, p.name, p.content, p.createdAt, p.updatedAt]);
        res.send(toCsv(headers, rows));
      } else {
        res.json(prompts);
      }
    } catch (err) {
      next(err);
    }
  },

  async judges(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      await assertAdmin(userId);

      const { format } = formatSchema.parse(req.query);
      const judges = await judgeRepository.findAll();

      setDownloadHeaders(res, 'judges', format);

      if (format === 'csv') {
        const headers = ['id', 'name', 'prompt', 'archivedAt', 'createdAt'];
        const rows = judges.map((j) => [j.id, j.name, j.prompt, j.archivedAt, j.createdAt]);
        res.send(toCsv(headers, rows));
      } else {
        res.json(judges);
      }
    } catch (err) {
      next(err);
    }
  },

  async bots(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      await assertAdmin(userId);

      const { format } = formatSchema.parse(req.query);

      const bots = await prisma.bot.findMany({
        select: {
          id: true,
          xAccountHandle: true,
          prompt: true,
          postMode: true,
          postsPerDay: true,
          active: true,
          knowledgeSource: true,
          judgeKnowledgeSource: true,
          createdAt: true,
          user: { select: { email: true } },
          behaviours: {
            select: {
              id: true,
              title: true,
              content: true,
              active: true,
              knowledgeSource: true,
              outcome: true,
              weight: true,
            },
            orderBy: { title: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      setDownloadHeaders(res, 'bots', format);

      if (format === 'csv') {
        const headers = [
          'botId',
          'handle',
          'ownerEmail',
          'prompt',
          'postMode',
          'postsPerDay',
          'active',
          'knowledgeSource',
          'judgeKnowledgeSource',
          'createdAt',
          'behaviourId',
          'behaviourTitle',
          'behaviourContent',
          'behaviourActive',
          'behaviourKnowledgeSource',
          'behaviourOutcome',
          'behaviourWeight',
        ];
        const rows: unknown[][] = [];
        for (const bot of bots) {
          if (bot.behaviours.length === 0) {
            rows.push([
              bot.id,
              bot.xAccountHandle,
              bot.user.email,
              bot.prompt,
              bot.postMode,
              bot.postsPerDay,
              bot.active,
              bot.knowledgeSource,
              bot.judgeKnowledgeSource,
              bot.createdAt,
              '',
              '',
              '',
              '',
              '',
              '',
              '',
            ]);
          } else {
            for (const b of bot.behaviours) {
              rows.push([
                bot.id,
                bot.xAccountHandle,
                bot.user.email,
                bot.prompt,
                bot.postMode,
                bot.postsPerDay,
                bot.active,
                bot.knowledgeSource,
                bot.judgeKnowledgeSource,
                bot.createdAt,
                b.id,
                b.title,
                b.content,
                b.active,
                b.knowledgeSource,
                b.outcome,
                b.weight,
              ]);
            }
          }
        }
        res.send(toCsv(headers, rows));
      } else {
        res.json(bots);
      }
    } catch (err) {
      next(err);
    }
  },
};

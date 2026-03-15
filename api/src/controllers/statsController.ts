import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { uuidSchema } from '../utils/validation.js';
import { botService } from '../services/botService.js';
import { prisma } from '../utils/prisma.js';

const botIdParamSchema = z.object({
  id: uuidSchema,
});

export const statsController = {
  async getBotStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id: botId } = botIdParamSchema.parse(req.params);

      // Verify ownership (throws NotFound/Forbidden if invalid)
      await botService.getBot(botId, userId);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        totalPosts,
        postsToday,
        ratingAgg,
        draftCount,
        approvedCount,
        scheduledCount,
        publishedCount,
        discardedCount,
      ] = await Promise.all([
        prisma.post.count({ where: { botId } }),
        prisma.post.count({
          where: { botId, createdAt: { gte: todayStart } },
        }),
        prisma.post.aggregate({
          where: { botId, rating: { not: null } },
          _avg: { rating: true },
        }),
        prisma.post.count({ where: { botId, status: 'draft' } }),
        prisma.post.count({ where: { botId, status: 'approved' } }),
        prisma.post.count({ where: { botId, status: 'scheduled' } }),
        prisma.post.count({ where: { botId, status: 'published' } }),
        prisma.post.count({ where: { botId, status: 'discarded' } }),
      ]);

      res.status(200).json({
        data: {
          totalPosts,
          postsToday,
          averageRating: ratingAgg._avg.rating ?? null,
          postsByStatus: {
            draft: draftCount,
            approved: approvedCount,
            scheduled: scheduledCount,
            published: publishedCount,
            discarded: discardedCount,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },
};

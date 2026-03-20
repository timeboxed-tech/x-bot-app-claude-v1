import { prisma } from '../utils/prisma.js';

export type BotForScheduling = {
  id: string;
  postsPerDay: number;
  minIntervalHours: number;
  preferredHoursStart: number;
  preferredHoursEnd: number;
  timezone: string;
};

export async function buildPostingContext(botId: string): Promise<{
  lastPublishedOrScheduledAt: Date | null;
  existingPostDates: Date[];
}> {
  // Get all published posts' dates and all approved posts' scheduledAt dates
  const [publishedPosts, approvedPosts] = await Promise.all([
    prisma.post.findMany({
      where: { botId, status: 'published', publishedAt: { not: null } },
      select: { publishedAt: true },
      orderBy: { publishedAt: 'desc' },
    }),
    prisma.post.findMany({
      where: { botId, status: 'approved', scheduledAt: { not: null } },
      select: { scheduledAt: true },
      orderBy: { scheduledAt: 'desc' },
    }),
  ]);

  const existingPostDates: Date[] = [];
  for (const p of publishedPosts) {
    if (p.publishedAt) existingPostDates.push(p.publishedAt);
  }
  for (const p of approvedPosts) {
    if (p.scheduledAt) existingPostDates.push(p.scheduledAt);
  }

  // Find the most recent date for gap checking
  let lastPublishedOrScheduledAt: Date | null = null;
  if (existingPostDates.length > 0) {
    lastPublishedOrScheduledAt = existingPostDates.reduce((a, b) => (a > b ? a : b));
  }

  return { lastPublishedOrScheduledAt, existingPostDates };
}

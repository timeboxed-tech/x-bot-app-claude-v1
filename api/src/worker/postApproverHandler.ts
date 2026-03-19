import { prisma } from '../utils/prisma.js';
import { postRepository } from '../repositories/postRepository.js';
import { findNextScheduledSlot } from '../services/scheduler.js';
import { log } from './activityLog.js';

/**
 * Post approver: auto-approves and schedules drafts for autonomous (auto) bots.
 * Picks up drafts with no safety flags on auto-mode bots, finds a slot,
 * transitions to approved with scheduledAt, and enqueues a post-publish job.
 */
export async function handlePostApprover(_jobId: string): Promise<void> {
  // Find draft posts from auto-mode bots that are not flagged
  const drafts = await prisma.post.findMany({
    where: {
      status: 'draft',
      flagged: false,
      bot: {
        postMode: 'auto',
        active: true,
        user: { archivedAt: null },
      },
    },
    include: { bot: true },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  log('post-approver', `Found ${drafts.length} draft(s) to consider for auto-approval`);

  let approved = 0;
  let noSlot = 0;

  for (const draft of drafts) {
    try {
      const bot = draft.bot;

      // Build context for slot finding
      const lastPost = await getLastPublishedOrScheduledAt(bot.id);
      const startOfToday = getStartOfTodayInTz(bot.timezone || 'UTC');
      const publishedToday = await postRepository.countPublishedByBotSince(bot.id, startOfToday);
      const approvedToday = await prisma.post.count({
        where: {
          botId: bot.id,
          status: 'approved',
          scheduledAt: { gte: startOfToday },
        },
      });

      const slot = findNextScheduledSlot(
        {
          postsPerDay: bot.postsPerDay,
          minIntervalHours: bot.minIntervalHours,
          preferredHoursStart: bot.preferredHoursStart,
          preferredHoursEnd: bot.preferredHoursEnd,
          timezone: bot.timezone || 'UTC',
        },
        {
          lastPublishedOrScheduledAt: lastPost,
          publishedTodayCount: publishedToday,
          approvedTodayCount: approvedToday,
        },
        48, // 48-hour search window for autonomous
      );

      if (!slot) {
        noSlot++;
        continue;
      }

      // Approve and schedule — post-publish recurring job will pick it up
      await prisma.post.update({
        where: { id: draft.id },
        data: {
          status: 'approved',
          scheduledAt: slot,
        },
      });

      approved++;
      log(
        'post-approver',
        `Approved post ${draft.id} for bot ${bot.xAccountHandle || bot.id}, scheduled at ${slot.toISOString()}`,
      );
    } catch (err) {
      log(
        'post-approver',
        `Error processing draft ${draft.id}: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
  }

  log('post-approver', `Completed: ${approved} approved, ${noSlot} no slot found`);
}

async function getLastPublishedOrScheduledAt(botId: string): Promise<Date | null> {
  const [lastPublished, lastScheduled] = await Promise.all([
    prisma.post.findFirst({
      where: { botId, status: 'published', publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    }),
    prisma.post.findFirst({
      where: { botId, status: 'approved', scheduledAt: { not: null } },
      orderBy: { scheduledAt: 'desc' },
      select: { scheduledAt: true },
    }),
  ]);

  const dates: Date[] = [];
  if (lastPublished?.publishedAt) dates.push(lastPublished.publishedAt);
  if (lastScheduled?.scheduledAt) dates.push(lastScheduled.scheduledAt);

  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (a > b ? a : b));
}

function getStartOfTodayInTz(timezone: string): Date {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return new Date(dateStr + 'T00:00:00Z');
}

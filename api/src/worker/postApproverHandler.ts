import { prisma } from '../utils/prisma.js';
import { findNextScheduledSlot } from '../services/scheduler.js';
import { buildPostingContext } from '../services/schedulerHelpers.js';
import { log } from './activityLog.js';

/**
 * Post approver: auto-approves and schedules drafts for autonomous (auto) bots.
 * Iterates through each active auto-mode bot, finds their unflagged drafts,
 * and schedules them using findNextScheduledSlot.
 */
export async function handlePostApprover(_jobId: string): Promise<string> {
  const bots = await prisma.bot.findMany({
    where: {
      postMode: 'auto',
      active: true,
      user: { archivedAt: null },
    },
  });

  let approved = 0;
  let noSlot = 0;
  let botsProcessed = 0;

  for (const bot of bots) {
    try {
      // Fetch drafts for this bot, biased toward older with randomness
      const allDrafts = await prisma.post.findMany({
        where: {
          botId: bot.id,
          status: 'draft',
          flagged: false,
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });

      if (allDrafts.length === 0) continue;
      botsProcessed++;

      // Weighted shuffle: older posts score lower (higher priority) with randomness
      const drafts = allDrafts
        .map((draft, i) => ({ draft, score: i + Math.random() * (allDrafts.length / 2) }))
        .sort((a, b) => a.score - b.score)
        .map((d) => d.draft);

      // Build context once per bot, refresh after each approval
      let context = await buildPostingContext(bot.id);

      for (const draft of drafts) {
        const slot = findNextScheduledSlot(
          {
            postsPerDay: bot.postsPerDay,
            minIntervalHours: bot.minIntervalHours,
            preferredHoursStart: bot.preferredHoursStart,
            preferredHoursEnd: bot.preferredHoursEnd,
            timezone: bot.timezone || 'UTC',
          },
          context,
          48,
        );

        if (!slot) {
          noSlot++;
          break; // No more slots for this bot, move to next bot
        }

        await prisma.post.update({
          where: { id: draft.id },
          data: { status: 'approved', scheduledAt: slot },
        });

        // Refresh context so the next draft sees the slot we just assigned
        context = await buildPostingContext(bot.id);

        approved++;
        log(
          'post-approver',
          `Approved post ${draft.id} for bot ${bot.xAccountHandle || bot.id}, scheduled at ${slot.toISOString()}`,
        );
      }
    } catch (err) {
      log(
        'post-approver',
        `Bot ${bot.xAccountHandle || bot.id}: error — ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
  }

  const message = `Approved ${approved} post(s) across ${botsProcessed} bot(s), ${noSlot} no slot`;
  log('post-approver', message);
  return message;
}

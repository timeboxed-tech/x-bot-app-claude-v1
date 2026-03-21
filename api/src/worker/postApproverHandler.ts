import { prisma } from '../utils/prisma.js';
import { findNextScheduledSlot } from '../services/scheduler.js';
import { buildPostingContext } from '../services/schedulerHelpers.js';
import { log } from './activityLog.js';

/**
 * Post approver: auto-approves and schedules drafts for autonomous (auto) bots.
 * Picks up drafts with no safety flags on auto-mode bots, finds a slot,
 * transitions to approved with scheduledAt, and enqueues a post-publish job.
 */
export async function handlePostApprover(_jobId: string): Promise<string> {
  // Find draft posts from auto-mode bots that are not flagged
  // Fetch extra, then shuffle with bias toward older posts
  const allDrafts = await prisma.post.findMany({
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
    take: 40,
  });

  // Weighted shuffle: older posts get higher priority but with randomness
  // Each post gets a score = index + random(0, total/2), then sort by score
  const drafts = allDrafts
    .map((draft, i) => ({ draft, score: i + Math.random() * (allDrafts.length / 2) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 20)
    .map((d) => d.draft);

  log('post-approver', `Found ${drafts.length} draft(s) to consider for auto-approval`);

  let approved = 0;
  let noSlot = 0;

  for (const draft of drafts) {
    try {
      const bot = draft.bot;

      // Build context for slot finding
      const context = await buildPostingContext(bot.id);

      const slot = findNextScheduledSlot(
        {
          postsPerDay: bot.postsPerDay,
          minIntervalHours: bot.minIntervalHours,
          preferredHoursStart: bot.preferredHoursStart,
          preferredHoursEnd: bot.preferredHoursEnd,
          timezone: bot.timezone || 'UTC',
        },
        context,
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

  const message = `Approved ${approved} post(s) from ${drafts.length} draft(s), ${noSlot} no slot`;
  log('post-approver', message);
  return message;
}

import { prisma } from '../utils/prisma.js';
import { postRepository } from '../repositories/postRepository.js';
import { botTipRepository } from '../repositories/botTipRepository.js';
import { botBehaviourRepository } from '../repositories/botBehaviourRepository.js';
import { selectWeightedBehaviour } from '../controllers/botController.js';
import { generateTweet } from '../services/aiService.js';
import { checkAndFlagPost } from '../services/urlValidationService.js';
import { log } from './activityLog.js';

/**
 * Draft handler: iterates through all active bots and generates drafts
 * where needed based on bot config and recent post activity.
 */
export async function handleDraftJob(jobId: string): Promise<void> {
  const bots = await prisma.bot.findMany({
    where: {
      active: true,
      user: { archivedAt: null },
      xAccessToken: { not: '' },
    },
  });

  log('draft', `Checking ${bots.length} active bot(s) for drafting`);

  let drafted = 0;
  let skipped = 0;

  for (const bot of bots) {
    try {
      const shouldDraft = await shouldGenerateDraft(bot);
      if (!shouldDraft) {
        skipped++;
        continue;
      }

      const tips = await botTipRepository.findByBotId(bot.id);
      const recentPosts = await postRepository.findRecentByBotId(bot.id, 10);
      const behaviours = await botBehaviourRepository.findActiveByBotId(bot.id);
      const selectedBehaviour = behaviours.length > 0 ? selectWeightedBehaviour(behaviours) : null;

      const effectiveSource =
        selectedBehaviour?.knowledgeSource && selectedBehaviour.knowledgeSource !== 'default'
          ? selectedBehaviour.knowledgeSource
          : bot.knowledgeSource;

      const result = await generateTweet(
        bot.prompt,
        tips.map((t: { content: string }) => t.content),
        recentPosts.map((p: { content: string }) => p.content),
        selectedBehaviour?.content,
        effectiveSource === 'ai+web',
      );

      if (!result.success) {
        log(
          'draft',
          `Bot ${bot.xAccountHandle || bot.id}: AI generation failed — ${result.error}`,
          'error',
        );
        continue;
      }

      const post = await postRepository.create({
        botId: bot.id,
        jobId,
        content: result.content,
        status: 'draft',
        scheduledAt: null,
        behaviourPrompt: selectedBehaviour?.content ?? null,
        behaviourTitle: selectedBehaviour?.title || null,
        generationPrompt: result.prompt ? JSON.stringify(result.prompt) : null,
      });

      await checkAndFlagPost(post.id);

      const checkedPost = await postRepository.findById(post.id);
      const isFlagged = checkedPost?.flagged ?? false;

      if (bot.postMode === 'auto' && !isFlagged) {
        await postRepository.update(post.id, {
          status: 'scheduled',
          scheduledAt: new Date(),
        });
      }
      // with-approval mode: drafts stay as 'draft' — user must rate 4-5 to approve

      drafted++;
      const status = bot.postMode === 'auto' && !isFlagged ? 'scheduled' : 'draft';
      log(
        'draft',
        `Bot ${bot.xAccountHandle || bot.id}: created ${status} post${isFlagged ? ' (flagged)' : ''}`,
      );
    } catch (err) {
      log(
        'draft',
        `Bot ${bot.xAccountHandle || bot.id}: error — ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
  }

  log('draft', `Completed: ${drafted} drafted, ${skipped} skipped`);
}

async function shouldGenerateDraft(bot: {
  id: string;
  postsPerDay: number;
  minIntervalHours: number;
  preferredHoursStart: number;
  preferredHoursEnd: number;
}): Promise<boolean> {
  // Check if within preferred hours (UTC)
  const nowHour = new Date().getUTCHours();
  if (bot.preferredHoursStart < bot.preferredHoursEnd) {
    if (nowHour < bot.preferredHoursStart || nowHour >= bot.preferredHoursEnd) {
      return false;
    }
  }
  // If start >= end (e.g. 22-6), the window wraps midnight — skip the check
  // since it's complex and the bot effectively wants all-day posting

  // Check daily quota
  const recentCount = await postRepository.countRecentByBot(bot.id, 24);
  if (recentCount >= bot.postsPerDay) {
    return false;
  }

  // Check minimum interval since last post
  const lastPost = await prisma.post.findFirst({
    where: {
      botId: bot.id,
      status: { in: ['draft', 'scheduled', 'published', 'approved'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  if (lastPost) {
    const hoursSinceLastPost = (Date.now() - lastPost.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastPost < bot.minIntervalHours) {
      return false;
    }
  }

  return true;
}

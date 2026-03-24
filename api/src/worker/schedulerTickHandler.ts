import { prisma } from '../utils/prisma.js';
import { postRepository } from '../repositories/postRepository.js';
import { botTipRepository } from '../repositories/botTipRepository.js';
import { botBehaviourRepository } from '../repositories/botBehaviourRepository.js';
import { selectWeightedBehaviour } from '../controllers/botController.js';
import { generateTweet, OUTCOME_PROMPT_KEY_MAP } from '../services/aiService.js';
import { checkAndFlagPost } from '../services/urlValidationService.js';
import { generateLikePostDraft } from '../services/likePostService.js';
import { generateReplyPostDraft } from '../services/replyPostService.js';
import { botJudgeRepository } from '../repositories/botJudgeRepository.js';
import { postReviewRepository } from '../repositories/postReviewRepository.js';
import { reviewPostWithJudge } from '../services/judgeAiService.js';
import { log } from './activityLog.js';

/**
 * Scheduler tick: for each active bot (with-approval or auto mode),
 * checks the pipeline count gate and generates a draft if needed.
 */
export async function handleSchedulerTick(jobId: string): Promise<string> {
  const bots = await prisma.bot.findMany({
    where: {
      active: true,
      postMode: { in: ['with-approval', 'auto'] },
      user: { archivedAt: null },
      xAccessToken: { not: '' },
    },
  });

  log('post-generator', `Checking ${bots.length} active bot(s)`);

  let generated = 0;
  let skipped = 0;

  for (const bot of bots) {
    try {
      // Pipeline count gate
      const pipelineCount = await getPipelineCount(bot.id);
      if (pipelineCount >= bot.postsPerDay * 2) {
        skipped++;
        continue;
      }

      // Check if today's published count has reached postsPerDay (with ±10% jitter)
      const jitteredCap = Math.max(1, Math.round(bot.postsPerDay * (0.9 + Math.random() * 0.2)));
      const todayPublished = await postRepository.countPublishedByBotSince(
        bot.id,
        getStartOfTodayUtc(),
      );
      if (todayPublished >= jitteredCap) {
        skipped++;
        continue;
      }

      // Generate draft directly
      await generateDraftForBot(bot, jobId);
      generated++;
    } catch (err) {
      log(
        'post-generator',
        `Bot ${bot.xAccountHandle || bot.id}: error — ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
  }

  const message = `Generated ${generated} draft(s), skipped ${skipped} bot(s)`;
  log('post-generator', message);
  return message;
}

async function generateDraftForBot(
  bot: {
    id: string;
    prompt: string;
    knowledgeSource: string;
    judgeKnowledgeSource: string;
    autoJudgeEnabled: boolean;
    autoJudgeMinRating: number;
    xAccountHandle: string;
    xAccessToken: string;
    xAccessSecret: string;
    postMode: string;
  },
  jobId: string,
): Promise<void> {
  const tips = await botTipRepository.findByBotId(bot.id);
  const recentPosts = await postRepository.findRecentByBotId(bot.id, 10);
  const behaviours = await botBehaviourRepository.findActiveByBotId(bot.id);
  const selectedBehaviour = behaviours.length > 0 ? selectWeightedBehaviour(behaviours) : null;

  if (selectedBehaviour?.outcome === 'like_post') {
    await generateLikePostDraft(bot, selectedBehaviour, jobId);
    log('post-generator', `Bot ${bot.xAccountHandle || bot.id}: created like_post draft`);
    return;
  }

  if (selectedBehaviour?.outcome === 'reply_to_post') {
    await generateReplyPostDraft(bot, selectedBehaviour, jobId);
    log('post-generator', `Bot ${bot.xAccountHandle || bot.id}: created reply_to_post draft`);
    return;
  }

  const effectiveSource =
    selectedBehaviour?.knowledgeSource && selectedBehaviour.knowledgeSource !== 'default'
      ? selectedBehaviour.knowledgeSource
      : bot.knowledgeSource;

  const outcomePromptKey = selectedBehaviour?.outcome
    ? (OUTCOME_PROMPT_KEY_MAP[selectedBehaviour.outcome] ?? 'tweet_generation')
    : 'tweet_generation';

  const result = await generateTweet(
    bot.prompt,
    tips.map((t: { content: string }) => t.content),
    recentPosts.map((p: { content: string }) => p.content),
    selectedBehaviour?.content,
    effectiveSource === 'ai+web',
    outcomePromptKey,
  );

  if (!result.success) {
    log(
      'post-generator',
      `Bot ${bot.xAccountHandle || bot.id}: AI generation failed — ${result.error}`,
      'error',
    );
    return;
  }

  const post = await postRepository.create({
    botId: bot.id,
    jobId,
    content: result.content,
    status: 'draft',
    scheduledAt: null,
    behaviourPrompt: selectedBehaviour?.content ?? null,
    behaviourTitle: selectedBehaviour?.title || null,
    generationPrompt: result.prompt
      ? JSON.stringify({
          outcome: selectedBehaviour?.outcome ?? 'write_post',
          systemPromptKey: outcomePromptKey,
          messages: result.prompt,
        })
      : null,
  });

  await checkAndFlagPost(post.id);

  // Flag posts that exceed the 280 character tweet limit
  if (result.content.length > 280) {
    await postRepository.update(post.id, {
      flagged: true,
      flagReasons: [`Exceeds 280 character limit (${result.content.length} chars)`],
    });
    log(
      'post-generator',
      `Bot ${bot.xAccountHandle || bot.id}: created draft post (flagged: ${result.content.length} chars)`,
    );
    return;
  }

  // Auto-judge if enabled and judges are assigned
  if (bot.autoJudgeEnabled) {
    try {
      const botJudges = await botJudgeRepository.findByBotId(bot.id);
      if (botJudges.length > 0) {
        const recentContents = recentPosts.map((p: { content: string }) => p.content);
        const useWebSearch = bot.judgeKnowledgeSource === 'ai+web';

        const reviewPromises = botJudges.map(async (bj) => {
          const judgeResult = await reviewPostWithJudge(
            bj.judge.name,
            bj.judge.prompt,
            result.content,
            recentContents,
            useWebSearch,
          );
          return {
            postId: post.id,
            judgeId: bj.judgeId,
            rating: judgeResult.rating,
            opinion: judgeResult.opinion,
          };
        });

        const reviews = await Promise.all(reviewPromises);
        await postReviewRepository.createMany(reviews);

        // Calculate average rating
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

        if (avgRating < bot.autoJudgeMinRating) {
          await postRepository.update(post.id, {
            status: 'discarded',
            flagReasons: [
              `Auto-judged below threshold: avg ${avgRating.toFixed(1)}/${bot.autoJudgeMinRating} (${reviews.map((r) => `${r.rating}/5`).join(', ')})`,
            ],
          });
          log(
            'post-generator',
            `Bot ${bot.xAccountHandle || bot.id}: post ${post.id} discarded (avg rating ${avgRating.toFixed(1)} < ${bot.autoJudgeMinRating})`,
          );
          return;
        }

        log(
          'post-generator',
          `Bot ${bot.xAccountHandle || bot.id}: post ${post.id} auto-judged (avg ${avgRating.toFixed(1)}, ${reviews.length} judges)`,
        );
      }
    } catch (err) {
      log(
        'post-generator',
        `Bot ${bot.xAccountHandle || bot.id}: auto-judge failed — ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
      // Don't fail post generation if judging fails
    }
  }

  log('post-generator', `Bot ${bot.xAccountHandle || bot.id}: created draft post`);
}

async function getPipelineCount(botId: string): Promise<number> {
  const startOfToday = getStartOfTodayUtc();

  const inPipeline = await prisma.post.count({
    where: {
      botId,
      status: { in: ['draft', 'approved'] },
    },
  });

  const publishedToday = await prisma.post.count({
    where: {
      botId,
      status: 'published',
      publishedAt: { gte: startOfToday },
    },
  });

  return inPipeline + publishedToday;
}

function getStartOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

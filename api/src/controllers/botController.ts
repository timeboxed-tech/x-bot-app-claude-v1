import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { botService } from '../services/botService.js';
import { generateTweet, OUTCOME_PROMPT_KEY_MAP } from '../services/aiService.js';
import { postRepository } from '../repositories/postRepository.js';
import { botTipRepository } from '../repositories/botTipRepository.js';
import { botBehaviourRepository } from '../repositories/botBehaviourRepository.js';
import { paginationSchema, uuidSchema } from '../utils/validation.js';
import { checkAndFlagPost } from '../services/urlValidationService.js';
import { generateLikePostDraft } from '../services/likePostService.js';
import { generateReplyPostDraft } from '../services/replyPostService.js';
import { prisma } from '../utils/prisma.js';

const createBotSchema = z.object({
  platform: z.enum(['x']).default('x'),
  prompt: z.string().min(1, 'Prompt is required'),
  postMode: z.enum(['auto', 'manual', 'with-approval']).default('manual'),
  postsPerDay: z.number().int().min(1).max(15).default(3),
  minIntervalHours: z.number().int().min(1).max(15).default(2),
  preferredHoursStart: z.number().int().min(0).max(23).default(0),
  preferredHoursEnd: z.number().int().min(1).max(24).default(24),
  knowledgeSource: z.enum(['ai', 'ai+web']).default('ai'),
  judgeKnowledgeSource: z.enum(['ai', 'ai+web']).default('ai'),
});

const updateBotSchema = z.object({
  prompt: z.string().min(1).optional(),
  postMode: z.enum(['auto', 'manual', 'with-approval']).optional(),
  postsPerDay: z.number().int().min(1).max(15).optional(),
  minIntervalHours: z.number().int().min(1).max(15).optional(),
  preferredHoursStart: z.number().int().min(0).max(23).optional(),
  preferredHoursEnd: z.number().int().min(1).max(24).optional(),
  knowledgeSource: z.enum(['ai', 'ai+web']).optional(),
  judgeKnowledgeSource: z.enum(['ai', 'ai+web']).optional(),
  active: z.boolean().optional(),
  xAccessToken: z.string().min(1).optional(),
  xAccessSecret: z.string().min(1).optional(),
  xAccountHandle: z.string().min(1).optional(),
});

const botIdParamSchema = z.object({
  id: uuidSchema,
});

const botIdBehaviourIdParamSchema = z.object({
  id: uuidSchema,
  behaviourId: uuidSchema,
});

export function selectWeightedBehaviour(
  behaviours: Array<{ weight: number; [key: string]: any }>,
): any {
  const totalWeight = behaviours.reduce((sum, b) => sum + b.weight, 0);
  if (totalWeight === 0) return behaviours[Math.floor(Math.random() * behaviours.length)];
  let random = Math.random() * totalWeight;
  for (const b of behaviours) {
    random -= b.weight;
    if (random <= 0) return b;
  }
  return behaviours[behaviours.length - 1];
}

export const botController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const body = createBotSchema.parse(req.body);
      const bot = await botService.createBot({ ...body, userId });

      res.status(201).json({
        data: bot,
      });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { page, pageSize } = paginationSchema.parse(req.query);
      const { bots, total } = await botService.listBots(userId, page, pageSize);

      res.status(200).json({
        data: bots,
        meta: { page, pageSize, total },
      });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = botIdParamSchema.parse(req.params);
      const bot = await botService.getBot(id, userId);

      res.status(200).json({
        data: bot,
      });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = botIdParamSchema.parse(req.params);
      const body = updateBotSchema.parse(req.body);
      const bot = await botService.updateBot(id, userId, body);

      res.status(200).json({
        data: bot,
      });
    } catch (err) {
      next(err);
    }
  },

  async generateDrafts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = botIdParamSchema.parse(req.params);
      const countSchema = z.object({
        count: z.number().int().min(1).max(5).default(3),
      });
      const { count } = countSchema.parse(req.body);

      const bot = await botService.getBot(id, userId);

      const tips = await botTipRepository.findByBotId(bot.id);
      const tipContents = tips.map((t: { content: string }) => t.content);
      const behaviours = await botBehaviourRepository.findActiveByBotId(bot.id);

      const posts = [];
      const errors: string[] = [];
      for (let i = 0; i < count; i++) {
        const recentPosts = await postRepository.findRecentByBotId(bot.id, 10);
        const recentContents = recentPosts.map((p: { content: string }) => p.content);
        const selectedBehaviour =
          behaviours.length > 0 ? selectWeightedBehaviour(behaviours) : null;

        // Route like_post behaviours to the dedicated handler
        if (selectedBehaviour?.outcome === 'like_post') {
          try {
            const fullBot = await prisma.bot.findUnique({ where: { id: bot.id } });
            if (!fullBot || !fullBot.xAccessToken || !fullBot.xAccessSecret) {
              errors.push('Bot X credentials not configured for like_post');
              continue;
            }
            const post = await generateLikePostDraft(
              {
                id: fullBot.id,
                prompt: fullBot.prompt,
                xAccessToken: fullBot.xAccessToken,
                xAccessSecret: fullBot.xAccessSecret,
                xAccountHandle: fullBot.xAccountHandle ?? '',
              },
              selectedBehaviour,
            );
            if (post) {
              posts.push(post);
            } else {
              console.error(
                `Like post generation returned null for bot ${bot.id} (attempt ${i + 1}/${count})`,
              );
              errors.push('Like post generation failed — check server logs for details');
            }
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Like post generation error';
            console.error(
              `Like post draft generation failed for bot ${bot.id} (attempt ${i + 1}/${count}): ${errorMessage}`,
            );
            errors.push(errorMessage);
          }
          continue;
        }

        // Route reply_to_post behaviours to the dedicated handler
        if (selectedBehaviour?.outcome === 'reply_to_post') {
          try {
            const fullBot = await prisma.bot.findUnique({ where: { id: bot.id } });
            if (!fullBot || !fullBot.xAccessToken || !fullBot.xAccessSecret) {
              errors.push('Bot X credentials not configured for reply_to_post');
              continue;
            }
            const post = await generateReplyPostDraft(
              {
                id: fullBot.id,
                prompt: fullBot.prompt,
                xAccessToken: fullBot.xAccessToken,
                xAccessSecret: fullBot.xAccessSecret,
                xAccountHandle: fullBot.xAccountHandle ?? '',
              },
              selectedBehaviour,
            );
            if (post) {
              posts.push(post);
            }
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Reply post generation error';
            console.error(
              `Reply post draft generation failed for bot ${bot.id} (attempt ${i + 1}/${count}): ${errorMessage}`,
            );
            errors.push(errorMessage);
          }
          continue;
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
          tipContents,
          recentContents,
          selectedBehaviour?.content,
          effectiveSource === 'ai+web',
          outcomePromptKey,
        );
        if (result.success) {
          const post = await postRepository.create({
            botId: bot.id,
            content: result.content,
            status: 'draft',
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
          // Fire-and-forget URL validation — don't block the response
          checkAndFlagPost(post.id).catch(console.error);
          posts.push(post);
        } else {
          const errorMessage = result.error || 'Unknown generation error';
          console.error(
            `Draft generation failed for bot ${bot.id} (attempt ${i + 1}/${count}): ${errorMessage}`,
          );
          errors.push(errorMessage);
        }
      }

      res.status(201).json({
        data: { posts, errors },
      });
    } catch (err) {
      next(err);
    }
  },

  async generateDraftForBehaviour(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { id, behaviourId } = botIdBehaviourIdParamSchema.parse(req.params);

      const bot = await botService.getBot(id, userId);
      const behaviour = await botBehaviourRepository.findById(behaviourId);

      if (!behaviour || behaviour.botId !== bot.id) {
        res.status(404).json({ error: 'Behaviour not found' });
        return;
      }

      // Route like_post outcomes to the dedicated handler
      if (behaviour.outcome === 'like_post') {
        const fullBot = await prisma.bot.findUnique({ where: { id: bot.id } });
        if (!fullBot || !fullBot.xAccessToken || !fullBot.xAccessSecret) {
          res.status(400).json({ error: 'Bot X credentials not configured' });
          return;
        }
        const post = await generateLikePostDraft(
          {
            id: fullBot.id,
            prompt: fullBot.prompt,
            xAccessToken: fullBot.xAccessToken,
            xAccessSecret: fullBot.xAccessSecret,
            xAccountHandle: fullBot.xAccountHandle ?? '',
          },
          behaviour,
        );
        if (!post) {
          console.error(
            `Like post generation returned null for bot ${bot.id}, behaviour ${behaviourId}`,
          );
          res
            .status(500)
            .json({ error: 'Like post generation failed — check server logs for details' });
          return;
        }
        res.status(201).json({ data: { post } });
        return;
      }

      // Route reply_to_post outcomes to the dedicated handler
      if (behaviour.outcome === 'reply_to_post') {
        const fullBot = await prisma.bot.findUnique({ where: { id: bot.id } });
        if (!fullBot || !fullBot.xAccessToken || !fullBot.xAccessSecret) {
          res.status(400).json({ error: 'Bot X credentials not configured' });
          return;
        }
        const post = await generateReplyPostDraft(
          {
            id: fullBot.id,
            prompt: fullBot.prompt,
            xAccessToken: fullBot.xAccessToken,
            xAccessSecret: fullBot.xAccessSecret,
            xAccountHandle: fullBot.xAccountHandle ?? '',
          },
          behaviour,
        );
        if (!post) {
          res
            .status(200)
            .json({ data: { post: null, message: 'No recent mentions found to reply to' } });
          return;
        }
        res.status(201).json({ data: { post } });
        return;
      }

      const tips = await botTipRepository.findByBotId(bot.id);
      const tipContents = tips.map((t: { content: string }) => t.content);
      const recentPosts = await postRepository.findRecentByBotId(bot.id, 10);
      const recentContents = recentPosts.map((p: { content: string }) => p.content);

      const effectiveSource =
        behaviour.knowledgeSource && behaviour.knowledgeSource !== 'default'
          ? behaviour.knowledgeSource
          : bot.knowledgeSource;
      const outcomePromptKey = behaviour.outcome
        ? (OUTCOME_PROMPT_KEY_MAP[behaviour.outcome] ?? 'tweet_generation')
        : 'tweet_generation';

      const result = await generateTweet(
        bot.prompt,
        tipContents,
        recentContents,
        behaviour.content,
        effectiveSource === 'ai+web',
        outcomePromptKey,
      );

      if (result.success) {
        const post = await postRepository.create({
          botId: bot.id,
          content: result.content,
          status: 'draft',
          behaviourPrompt: behaviour.content ?? null,
          behaviourTitle: behaviour.title || null,
          generationPrompt: result.prompt
            ? JSON.stringify({
                outcome: behaviour.outcome ?? 'write_post',
                systemPromptKey: outcomePromptKey,
                messages: result.prompt,
              })
            : null,
        });
        checkAndFlagPost(post.id).catch(console.error);
        res.status(201).json({ data: { post } });
      } else {
        console.error(
          `generateDraftForBehaviour failed for bot ${bot.id}, behaviour ${behaviourId}: ${result.error}`,
        );
        res.status(500).json({ error: result.error || 'Generation failed' });
      }
    } catch (err) {
      console.error(
        `generateDraftForBehaviour error for params ${JSON.stringify(req.params)}:`,
        err instanceof Error ? err.message : err,
      );
      if (err instanceof Error) {
        console.error(err.stack);
      }
      next(err);
    }
  },
};

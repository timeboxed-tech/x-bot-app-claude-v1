import Anthropic from '@anthropic-ai/sdk';
import { getMentions, getAuthenticatedUserId, SearchTweetResult } from './xApiService.js';
import { systemPromptRepository } from '../repositories/systemPromptRepository.js';
import { postRepository } from '../repositories/postRepository.js';
import { DEFAULT_SYSTEM_PROMPTS } from '../constants/defaultSystemPrompts.js';
import { log } from '../worker/activityLog.js';
import { prisma } from '../utils/prisma.js';

type BotForReplyPost = {
  id: string;
  prompt: string;
  xAccessToken: string;
  xAccessSecret: string;
  xAccountHandle: string;
};

type BehaviourForReplyPost = {
  title: string;
  content: string;
  queryPrompt?: string | null;
  outcome: string;
};

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}

/**
 * Use AI to select ONE mention to reply to and generate a reply.
 */
async function selectMentionAndGenerateReply(
  client: Anthropic,
  candidates: SearchTweetResult[],
  behaviourPrompt: string,
  botPrompt: string,
  systemPrompt: string,
): Promise<{ tweetId: string; replyText: string; reasoning: string; rawResponse: string }> {
  const candidateList = candidates
    .map((t, i) => {
      return `${i + 1}. @${t.authorUsername ?? 'unknown'} (ID: ${t.id}): "${t.text}"`;
    })
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: `${systemPrompt}\n\n${botPrompt}`,
    messages: [
      {
        role: 'user',
        content: `${behaviourPrompt}\n\nHere are recent mentions and quote tweets of our account. Select the ONE best mention to reply to that aligns with the brand/persona described above. Then generate a reply (under 280 characters) that is conversational, authentic, and relevant to the original post. Do not use hashtags.\n\nMentions:\n${candidateList}\n\nRespond in EXACTLY this format:\nTWEET_ID: <id>\nREPLY: <reply text>\nREASON: <why this mention was selected and why this reply works>`,
      },
    ],
  });

  const text = extractText(response.content);
  if (!text) throw new Error('Empty response from AI for reply generation');

  // Parse TWEET_ID
  const tweetIdMatch = text.match(/TWEET_ID:\s*(\d+)/);
  let tweetId = tweetIdMatch?.[1] ?? '';

  // Parse REPLY
  const replyMatch = text.match(/REPLY:\s*(.+?)(?:\nREASON:|$)/s);
  let replyText = replyMatch?.[1]?.trim() ?? '';

  // Parse REASON
  const reasonMatch = text.match(/REASON:\s*(.+)/s);
  const reasoning = reasonMatch?.[1]?.trim() ?? text;

  // Validate tweet ID exists in candidates
  if (tweetId && !candidates.some((c) => c.id === tweetId)) {
    // Try to find a mentioned candidate ID as fallback
    tweetId = '';
    for (const candidate of candidates) {
      if (text.includes(candidate.id)) {
        tweetId = candidate.id;
        break;
      }
    }
  }

  // If no tweet ID found at all, try fallback
  if (!tweetId) {
    for (const candidate of candidates) {
      if (text.includes(candidate.id)) {
        tweetId = candidate.id;
        break;
      }
    }
  }

  // Ensure reply is under 280 characters
  if (replyText.length > 280) {
    replyText = replyText.substring(0, 277) + '...';
  }

  return { tweetId, replyText, reasoning, rawResponse: text };
}

/**
 * Generate a reply_to_post draft: fetch mentions of the bot account,
 * select one to reply to, and generate a reply.
 */
export async function generateReplyPostDraft(
  bot: BotForReplyPost,
  behaviour: BehaviourForReplyPost,
  jobId?: string,
) {
  const client = getClient();
  if (!client) {
    console.error(
      `[replyPostService] Bot ${bot.xAccountHandle || bot.id}: ANTHROPIC_API_KEY not set, cannot generate reply`,
    );
    log('draft', `Bot ${bot.xAccountHandle || bot.id}: AI service not configured`, 'error');
    return null;
  }

  // Get the reply_generation system prompt
  const fallback = DEFAULT_SYSTEM_PROMPTS['reply_generation'] ?? '';
  let systemPrompt: string;
  try {
    const dbPrompt = await systemPromptRepository.findByKey('reply_generation');
    systemPrompt = dbPrompt?.content ?? fallback;
  } catch {
    systemPrompt = fallback;
  }

  // Track process steps for visualisation
  type ProcessStep = { step: string; input: string; output: string };
  const processSteps: ProcessStep[] = [];

  // Step 1: Get bot's user ID
  let userId: string;
  try {
    const meResult = await getAuthenticatedUserId(bot.xAccessToken, bot.xAccessSecret, bot.id);
    if (!meResult.success || !meResult.userId) {
      console.error(
        `[replyPostService] Bot ${bot.xAccountHandle || bot.id}: failed to get user ID — ${meResult.error ?? 'unknown'}`,
      );
      log(
        'draft',
        `Bot ${bot.xAccountHandle || bot.id}: failed to get user ID — ${meResult.error ?? 'unknown'}`,
        'error',
      );
      return null;
    }
    userId = meResult.userId;
  } catch (err) {
    console.error(
      `[replyPostService] Bot ${bot.xAccountHandle || bot.id}: failed to get user ID — ${err instanceof Error ? err.message : String(err)}`,
    );
    log(
      'draft',
      `Bot ${bot.xAccountHandle || bot.id}: failed to get user ID — ${err instanceof Error ? err.message : String(err)}`,
      'error',
    );
    return null;
  }

  // Step 2: Fetch recent mentions via X API
  let mentions: SearchTweetResult[] = [];
  try {
    const result = await getMentions(userId, bot.xAccessToken, bot.xAccessSecret, bot.id, 20);
    if (result.success && result.tweets) {
      mentions = result.tweets;
    } else if (result.error) {
      log(
        'draft',
        `Bot ${bot.xAccountHandle || bot.id}: mentions fetch failed — ${result.error}`,
        'warn',
      );
    }
  } catch (err) {
    console.error('Mentions fetch failed:', err);
    log(
      'draft',
      `Bot ${bot.xAccountHandle || bot.id}: mentions fetch error — ${err instanceof Error ? err.message : String(err)}`,
      'error',
    );
  }

  if (mentions.length === 0) {
    console.error(
      `[replyPostService] Bot ${bot.xAccountHandle || bot.id}: no recent mentions found, skipping reply_to_post`,
    );
    log(
      'draft',
      `Bot ${bot.xAccountHandle || bot.id}: no recent mentions found, skipping reply_to_post`,
    );
    return null;
  }

  log('draft', `Bot ${bot.xAccountHandle || bot.id}: found ${mentions.length} recent mentions`);

  const mentionSummaries = mentions
    .map((t) => `@${t.authorUsername ?? 'unknown'}: "${t.text}"`)
    .join('\n');
  processSteps.push({
    step: 'Fetch Mentions',
    input: `@${bot.xAccountHandle} (user ID: ${userId})`,
    output: mentionSummaries,
  });

  // Step 2b: Dedup — filter out mentions we have already replied to (or have pending drafts for)
  const totalBeforeDedup = mentions.length;
  try {
    const recentPosts = await prisma.post.findMany({
      where: {
        botId: bot.id,
        metadata: { not: null },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { metadata: true },
    });

    const repliedTweetIds = new Set<string>();
    for (const post of recentPosts) {
      if (typeof post.metadata === 'string') {
        try {
          const parsed = JSON.parse(post.metadata) as Record<string, unknown>;
          if (typeof parsed.replyToTweetId === 'string') {
            repliedTweetIds.add(parsed.replyToTweetId);
          }
        } catch {
          // skip unparseable metadata
        }
      }
    }

    if (repliedTweetIds.size > 0) {
      mentions = mentions.filter((m) => !repliedTweetIds.has(m.id));
    }
  } catch (err) {
    // Non-fatal: if dedup query fails, proceed with all mentions
    console.error('Dedup query failed, proceeding without dedup:', err);
  }

  processSteps.push({
    step: 'Dedup Filter',
    input: `${totalBeforeDedup} mentions fetched`,
    output: `${mentions.length} mentions remaining after filtering already-replied tweets`,
  });

  if (mentions.length === 0) {
    console.error(
      `[replyPostService] Bot ${bot.xAccountHandle || bot.id}: all ${totalBeforeDedup} mentions already replied to, skipping`,
    );
    log(
      'draft',
      `Bot ${bot.xAccountHandle || bot.id}: all ${totalBeforeDedup} mentions already replied to, skipping`,
    );
    return null;
  }

  // Step 3: AI selection + reply generation
  let tweetId: string;
  let replyText: string;
  let reasoning: string;
  try {
    const selectionResult = await selectMentionAndGenerateReply(
      client,
      mentions,
      behaviour.content,
      bot.prompt,
      systemPrompt,
    );
    tweetId = selectionResult.tweetId;
    replyText = selectionResult.replyText;
    reasoning = selectionResult.reasoning;
    processSteps.push({
      step: 'Behaviour Prompt',
      input: behaviour.content,
      output: selectionResult.rawResponse,
    });
  } catch (err) {
    console.error('Failed to select mention and generate reply:', err);
    log(
      'draft',
      `Bot ${bot.xAccountHandle || bot.id}: AI selection/reply failed — ${err instanceof Error ? err.message : String(err)}`,
      'error',
    );
    return null;
  }

  if (!tweetId || !replyText) {
    console.error(
      `[replyPostService] Bot ${bot.xAccountHandle || bot.id}: AI did not return a valid tweet ID or reply (tweetId=${tweetId || 'empty'}, replyText=${replyText ? 'present' : 'empty'})`,
    );
    log(
      'draft',
      `Bot ${bot.xAccountHandle || bot.id}: AI did not return a valid tweet ID or reply, skipping`,
      'warn',
    );
    return null;
  }

  // Step 4: Build draft content
  const selectedTweet = mentions.find((t) => t.id === tweetId);
  const replyToContent = selectedTweet?.text ?? '';
  const replyToAuthor = selectedTweet?.authorUsername ?? 'unknown';

  const content = replyText;

  processSteps.push({
    step: 'Final Result',
    input: `Replying to @${replyToAuthor} (tweet ${tweetId}): "${replyToContent}"`,
    output: content,
  });

  // Randomly decide whether to also like the post (50% chance)
  const alsoLike = Math.random() < 0.5;

  const replyToAuthorId = selectedTweet?.authorId;

  const metadata = JSON.stringify({
    outcome: 'reply_to_post',
    replyToTweetId: tweetId,
    replyToAuthorId,
    replyToContent,
    replyToAuthor,
    alsoLike,
    processSteps,
  });

  const generationPrompt = JSON.stringify({
    outcome: 'reply_to_post',
    systemPromptKey: 'reply_generation',
    source: 'mentions',
    mentionCount: mentions.length,
    reasoning,
  });

  const post = await postRepository.create({
    botId: bot.id,
    jobId,
    content,
    status: 'draft',
    scheduledAt: null,
    behaviourPrompt: behaviour.content,
    behaviourTitle: behaviour.title || null,
    generationPrompt,
    metadata,
  });

  log(
    'draft',
    `Bot ${bot.xAccountHandle || bot.id}: created reply_to_post draft replying to tweet ${tweetId}`,
  );

  return post;
}

import Anthropic from '@anthropic-ai/sdk';
import { searchTweets, SearchTweetResult } from './xApiService.js';
import { systemPromptRepository } from '../repositories/systemPromptRepository.js';
import { postRepository } from '../repositories/postRepository.js';
import { DEFAULT_SYSTEM_PROMPTS } from '../constants/defaultSystemPrompts.js';
import { log } from '../worker/activityLog.js';

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
 * Generate search queries from the behaviour's queryPrompt using AI.
 */
async function generateSearchQueries(
  client: Anthropic,
  queryPrompt: string,
  systemPrompt: string,
): Promise<string[]> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `${queryPrompt}\n\nGenerate 5 short, broad search queries (1-3 words each) that would return popular, recent tweets related to the above topic. Avoid overly specific or long queries. Return ONLY the queries, one per line, no numbering or bullets.`,
      },
    ],
  });

  const text = extractText(response.content);
  if (!text) throw new Error('Empty response from AI for search queries');

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.length < 200);
}

/**
 * Use AI to select ONE post to reply to and generate a reply.
 */
async function selectPostAndGenerateReply(
  client: Anthropic,
  candidates: SearchTweetResult[],
  behaviourPrompt: string,
  botPrompt: string,
  systemPrompt: string,
): Promise<{ tweetId: string; replyText: string; reasoning: string; rawResponse: string }> {
  const candidateList = candidates
    .map((t, i) => {
      const metrics = t.publicMetrics
        ? ` [Likes: ${t.publicMetrics.likeCount}, RTs: ${t.publicMetrics.retweetCount}, Replies: ${t.publicMetrics.replyCount}]`
        : '';
      return `${i + 1}. @${t.authorUsername ?? 'unknown'} (ID: ${t.id}): "${t.text}"${metrics}`;
    })
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: `${systemPrompt}\n\n${botPrompt}`,
    messages: [
      {
        role: 'user',
        content: `${behaviourPrompt}\n\nHere are candidate posts found on X. Select the ONE best post to reply to that aligns with the brand/persona described above. Then generate a reply (under 280 characters) that is conversational, authentic, and relevant to the original post. Do not use hashtags.\n\nCandidate posts:\n${candidateList}\n\nRespond in EXACTLY this format:\nTWEET_ID: <id>\nREPLY: <reply text>\nREASON: <why this tweet was selected and why this reply works>`,
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
 * Generate a reply_to_post draft: search X for relevant posts,
 * select one to reply to, and generate a reply.
 */
export async function generateReplyPostDraft(
  bot: BotForReplyPost,
  behaviour: BehaviourForReplyPost,
  jobId?: string,
) {
  const client = getClient();
  if (!client) {
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

  // Step 1: Generate search queries from queryPrompt
  const queryPrompt = behaviour.queryPrompt || behaviour.content;
  let queries: string[];
  try {
    queries = await generateSearchQueries(client, queryPrompt, systemPrompt);
    processSteps.push({
      step: 'Query Prompt',
      input: queryPrompt,
      output: queries.join('\n'),
    });
    log(
      'draft',
      `Bot ${bot.xAccountHandle || bot.id}: generated ${queries.length} search queries for reply_to_post`,
    );
  } catch (err) {
    console.error('Failed to generate search queries for reply_to_post:', err);
    log(
      'draft',
      `Bot ${bot.xAccountHandle || bot.id}: failed to generate search queries — ${err instanceof Error ? err.message : String(err)}`,
      'error',
    );
    return null;
  }

  if (queries.length === 0) {
    log(
      'draft',
      `Bot ${bot.xAccountHandle || bot.id}: no search queries generated, skipping reply_to_post`,
      'warn',
    );
    return null;
  }

  // Step 2: Search X API for each query
  const allTweets: SearchTweetResult[] = [];
  const seenIds = new Set<string>();

  const MIN_CANDIDATES = 5;

  for (const query of queries.slice(0, 5)) {
    try {
      const searchQuery = `${query} -is:retweet`;
      const result = await searchTweets(
        searchQuery,
        bot.xAccessToken,
        bot.xAccessSecret,
        bot.id,
        20,
      );
      if (result.success && result.tweets) {
        for (const tweet of result.tweets) {
          if (!seenIds.has(tweet.id)) {
            seenIds.add(tweet.id);
            allTweets.push(tweet);
          }
        }
      } else if (result.error) {
        log(
          'draft',
          `Bot ${bot.xAccountHandle || bot.id}: search failed for query "${query}" — ${result.error}`,
          'warn',
        );
      }
    } catch (err) {
      console.error(`Search failed for query "${query}":`, err);
      log(
        'draft',
        `Bot ${bot.xAccountHandle || bot.id}: search error for query "${query}" — ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
  }

  if (allTweets.length === 0) {
    log(
      'draft',
      `Bot ${bot.xAccountHandle || bot.id}: no tweets found from search, skipping reply_to_post`,
      'warn',
    );
    return null;
  }

  if (allTweets.length < MIN_CANDIDATES) {
    log(
      'draft',
      `Bot ${bot.xAccountHandle || bot.id}: only found ${allTweets.length} unique tweets (wanted at least ${MIN_CANDIDATES}), proceeding with available results`,
      'warn',
    );
  }

  // Limit to top 15 candidates
  const candidates = allTweets.slice(0, 15);
  log(
    'draft',
    `Bot ${bot.xAccountHandle || bot.id}: found ${allTweets.length} unique tweets, using top ${candidates.length} as candidates`,
  );

  const tweetSummaries = candidates
    .map((t) => `@${t.authorUsername ?? 'unknown'}: "${t.text}"`)
    .join('\n');
  processSteps.push({
    step: 'X API Search',
    input: queries.join(', '),
    output: tweetSummaries,
  });

  // Step 3: AI selection + reply generation
  let tweetId: string;
  let replyText: string;
  let reasoning: string;
  try {
    const selectionResult = await selectPostAndGenerateReply(
      client,
      candidates,
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
    console.error('Failed to select post and generate reply:', err);
    log(
      'draft',
      `Bot ${bot.xAccountHandle || bot.id}: AI selection/reply failed — ${err instanceof Error ? err.message : String(err)}`,
      'error',
    );
    return null;
  }

  if (!tweetId || !replyText) {
    log(
      'draft',
      `Bot ${bot.xAccountHandle || bot.id}: AI did not return a valid tweet ID or reply, skipping`,
      'warn',
    );
    return null;
  }

  // Step 4: Build draft content
  const selectedTweet = candidates.find((t) => t.id === tweetId);
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

  const metadata = JSON.stringify({
    outcome: 'reply_to_post',
    replyToTweetId: tweetId,
    replyToContent,
    replyToAuthor,
    alsoLike,
    processSteps,
  });

  const generationPrompt = JSON.stringify({
    outcome: 'reply_to_post',
    systemPromptKey: 'reply_generation',
    queries,
    candidateCount: candidates.length,
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

import Anthropic from '@anthropic-ai/sdk';
import { searchTweets, SearchTweetResult } from './xApiService.js';
import { systemPromptRepository } from '../repositories/systemPromptRepository.js';
import { postRepository } from '../repositories/postRepository.js';
import { DEFAULT_SYSTEM_PROMPTS } from '../constants/defaultSystemPrompts.js';
import { log } from '../worker/activityLog.js';

type BotForLikePost = {
  id: string;
  prompt: string;
  xAccessToken: string;
  xAccessSecret: string;
  xAccountHandle: string;
};

type BehaviourForLikePost = {
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
        content: `${queryPrompt}\n\nGenerate 3-5 concise X/Twitter search queries based on the above. Return ONLY the queries, one per line, no numbering or bullets. Each query should be a few keywords suitable for X search.`,
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
 * Use AI to select the top 3 posts to like from a list of candidates.
 */
async function selectPostsToLike(
  client: Anthropic,
  candidates: SearchTweetResult[],
  behaviourPrompt: string,
  botPrompt: string,
  systemPrompt: string,
): Promise<{ selectedIds: string[]; reasoning: string }> {
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
        content: `${behaviourPrompt}\n\nHere are candidate posts found on X. Select the top 3 posts that best align with the brand/persona described above and would be most strategic to like. For each selection, explain briefly why.\n\nCandidate posts:\n${candidateList}\n\nRespond in this format:\nSELECTED: <tweet_id_1>, <tweet_id_2>, <tweet_id_3>\nREASONING:\n1. [tweet_id]: reason\n2. [tweet_id]: reason\n3. [tweet_id]: reason`,
      },
    ],
  });

  const text = extractText(response.content);
  if (!text) throw new Error('Empty response from AI for post selection');

  // Parse selected IDs from the SELECTED line
  const selectedLine = text.split('\n').find((line) => line.toUpperCase().startsWith('SELECTED:'));
  const selectedIds: string[] = [];

  if (selectedLine) {
    const idsPart = selectedLine.replace(/^SELECTED:\s*/i, '');
    const parsed = idsPart.split(',').map((id) => id.trim());
    // Validate each ID exists in our candidates
    for (const id of parsed) {
      if (candidates.some((c) => c.id === id)) {
        selectedIds.push(id);
      }
    }
  }

  // Fallback: if parsing failed, try to find tweet IDs mentioned in the text
  if (selectedIds.length === 0) {
    for (const candidate of candidates) {
      if (text.includes(candidate.id)) {
        selectedIds.push(candidate.id);
      }
      if (selectedIds.length >= 3) break;
    }
  }

  return { selectedIds: selectedIds.slice(0, 3), reasoning: text };
}

/**
 * Generate a like_post draft: search X for relevant posts and select top 3 to like.
 */
export async function generateLikePostDraft(
  bot: BotForLikePost,
  behaviour: BehaviourForLikePost,
  jobId: string,
): Promise<void> {
  const client = getClient();
  if (!client) {
    log('draft', `Bot ${bot.xAccountHandle || bot.id}: AI service not configured`, 'error');
    return;
  }

  // Get the like_evaluation system prompt
  const fallback = DEFAULT_SYSTEM_PROMPTS['like_evaluation'] ?? '';
  let systemPrompt: string;
  try {
    const dbPrompt = await systemPromptRepository.findByKey('like_evaluation');
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
      `Bot ${bot.xAccountHandle || bot.id}: generated ${queries.length} search queries for like_post`,
    );
  } catch (err) {
    console.error('Failed to generate search queries for like_post:', err);
    log(
      'draft',
      `Bot ${bot.xAccountHandle || bot.id}: failed to generate search queries — ${err instanceof Error ? err.message : String(err)}`,
      'error',
    );
    return;
  }

  if (queries.length === 0) {
    log(
      'draft',
      `Bot ${bot.xAccountHandle || bot.id}: no search queries generated, skipping like_post`,
      'warn',
    );
    return;
  }

  // Step 2: Search X API for each query
  const allTweets: SearchTweetResult[] = [];
  const seenIds = new Set<string>();

  for (const query of queries.slice(0, 5)) {
    try {
      const result = await searchTweets(query, bot.xAccessToken, bot.xAccessSecret, bot.id, 10);
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
      `Bot ${bot.xAccountHandle || bot.id}: no tweets found from search, skipping like_post`,
      'warn',
    );
    return;
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

  // Step 3: AI selection
  let selectedIds: string[];
  let reasoning: string;
  try {
    const selectionResult = await selectPostsToLike(
      client,
      candidates,
      behaviour.content,
      bot.prompt,
      systemPrompt,
    );
    selectedIds = selectionResult.selectedIds;
    reasoning = selectionResult.reasoning;
    processSteps.push({
      step: 'Behaviour Prompt',
      input: behaviour.content,
      output: reasoning,
    });
  } catch (err) {
    console.error('Failed to select posts to like:', err);
    log(
      'draft',
      `Bot ${bot.xAccountHandle || bot.id}: AI selection failed — ${err instanceof Error ? err.message : String(err)}`,
      'error',
    );
    return;
  }

  if (selectedIds.length === 0) {
    log(
      'draft',
      `Bot ${bot.xAccountHandle || bot.id}: AI selected no posts to like, skipping`,
      'warn',
    );
    return;
  }

  // Step 4: Build draft content
  const selectedTweets = selectedIds
    .map((id) => candidates.find((t) => t.id === id))
    .filter((t): t is SearchTweetResult => t !== undefined);

  const contentLines = [`Like ${selectedTweets.length} post(s):`];
  for (let i = 0; i < selectedTweets.length; i++) {
    const t = selectedTweets[i];
    const truncatedText = t.text.length > 100 ? t.text.substring(0, 100) + '...' : t.text;
    contentLines.push(
      `${i + 1}. @${t.authorUsername ?? 'unknown'}: ${truncatedText} [tweet:${t.id}]`,
    );
  }
  const content = contentLines.join('\n');

  const selectedTweetsSummary = selectedTweets
    .map((t) => `@${t.authorUsername ?? 'unknown'}: "${t.text}"`)
    .join('\n');
  processSteps.push({
    step: 'Final Result',
    input: selectedTweetsSummary,
    output: content,
  });

  const metadata = JSON.stringify({
    outcome: 'like_post',
    tweetIds: selectedIds,
    selectedTweets: selectedTweets.map((t) => ({
      id: t.id,
      authorUsername: t.authorUsername,
      text: t.text,
    })),
    processSteps,
  });

  const generationPrompt = JSON.stringify({
    outcome: 'like_post',
    systemPromptKey: 'like_evaluation',
    queries,
    candidateCount: candidates.length,
    reasoning,
  });

  await postRepository.create({
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
    `Bot ${bot.xAccountHandle || bot.id}: created like_post draft with ${selectedIds.length} tweets`,
  );
}

import Anthropic from '@anthropic-ai/sdk';
import { systemPromptRepository } from '../repositories/systemPromptRepository.js';
import { DEFAULT_SYSTEM_PROMPTS } from '../constants/defaultSystemPrompts.js';

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

const FALLBACK_JUDGE_TEMPLATE = DEFAULT_SYSTEM_PROMPTS['judge_review'];

const LIKE_POST_JUDGE_CRITERIA = `
You are reviewing a like_post action — the AI selected posts to like on behalf of the account.
Evaluate the selections on the following criteria:
1. Relevance — do the liked posts align with the bot's stated interests and brand?
2. Quality — are these high-quality, thoughtful posts worth engaging with?
3. Recency — are the posts relatively recent and timely?
4. Selection Reasoning — does the AI's reasoning for selecting these posts make sense?

Provide a concise opinion (2-3 sentences max) and rate the overall selection 1-5.
Format your response as: your opinion text, then on a new line exactly "Rating: X/5"`;

export type LikePostReviewContext = {
  botPrompt: string;
  behaviourPrompt: string;
  selectedTweets: Array<{
    id: string;
    authorUsername?: string;
    text: string;
  }>;
  reasoning: string;
};

// Simple in-memory cache with 5-minute TTL
const promptCache = new Map<string, { content: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getCachedPrompt(key: string, fallback: string): Promise<string> {
  const cached = promptCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.content;
  }

  try {
    const prompt = await systemPromptRepository.findByKey(key);
    if (prompt) {
      promptCache.set(key, { content: prompt.content, expiresAt: Date.now() + CACHE_TTL_MS });
      return prompt.content;
    }
  } catch {
    // Fall back to hardcoded prompt on DB error
  }

  return fallback;
}

async function buildSystemPrompt(name: string, personalityPrompt: string): Promise<string> {
  const template = await getCachedPrompt('judge_review', FALLBACK_JUDGE_TEMPLATE);
  return template.replace('{name}', name).replace('{personalityPrompt}', personalityPrompt);
}

function buildLikePostSystemPrompt(name: string, personalityPrompt: string): string {
  return `You are ${name}. ${personalityPrompt}.\n${LIKE_POST_JUDGE_CRITERIA}`;
}

function parseRating(response: string): { opinion: string; rating: number } {
  const ratingMatch = response.match(/Rating:\s*(\d)\s*\/\s*5/);
  const rating = ratingMatch ? parseInt(ratingMatch[1], 10) : 3;
  const clampedRating = Math.max(1, Math.min(5, rating));

  // Extract opinion: everything before the Rating line
  const ratingIndex = response.lastIndexOf('Rating:');
  const opinion = ratingIndex !== -1 ? response.substring(0, ratingIndex).trim() : response.trim();

  return { opinion, rating: clampedRating };
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}

export async function reviewPostWithJudge(
  judgeName: string,
  judgePrompt: string,
  postContent: string,
  recentPosts?: string[],
  useWebSearch: boolean = false,
): Promise<{ opinion: string; rating: number }> {
  const client = getClient();
  if (!client) {
    return {
      opinion: 'AI service not configured -- set ANTHROPIC_API_KEY',
      rating: 3,
    };
  }

  const systemPrompt = await buildSystemPrompt(judgeName, judgePrompt);

  const userContent =
    recentPosts && recentPosts.length > 0
      ? `Today's date: ${new Date().toISOString().split('T')[0]}\n\nTweet to review:\n${postContent}\n\nRecent posts from this account for context (consider repetition):\n${recentPosts.map((p) => '- ' + p).join('\n')}`
      : `Today's date: ${new Date().toISOString().split('T')[0]}\n\nTweet to review:\n${postContent}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: useWebSearch ? 1024 : 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
    ...(useWebSearch
      ? {
          tools: [
            {
              type: 'web_search_20250305',
              name: 'web_search',
              max_uses: 3,
            } as Anthropic.Messages.WebSearchTool20250305,
          ],
        }
      : {}),
  });

  const text = extractText(response.content);
  if (!text) {
    throw new Error('Unexpected response format from Claude API');
  }

  return parseRating(text);
}

export async function reviewLikePostWithJudge(
  judgeName: string,
  judgePrompt: string,
  likeContext: LikePostReviewContext,
  useWebSearch: boolean = false,
): Promise<{ opinion: string; rating: number }> {
  const client = getClient();
  if (!client) {
    return {
      opinion: 'AI service not configured -- set ANTHROPIC_API_KEY',
      rating: 3,
    };
  }

  const systemPrompt = buildLikePostSystemPrompt(judgeName, judgePrompt);

  const tweetList = likeContext.selectedTweets
    .map((t, i) => `${i + 1}. @${t.authorUsername ?? 'unknown'}: "${t.text}"`)
    .join('\n');

  const userContent = `Today's date: ${new Date().toISOString().split('T')[0]}

Bot's interests/prompt:
${likeContext.botPrompt}

Behaviour prompt that guided the selection:
${likeContext.behaviourPrompt}

Selected posts to like:
${tweetList}

AI's reasoning for selection:
${likeContext.reasoning}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: useWebSearch ? 1024 : 400,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
    ...(useWebSearch
      ? {
          tools: [
            {
              type: 'web_search_20250305',
              name: 'web_search',
              max_uses: 3,
            } as Anthropic.Messages.WebSearchTool20250305,
          ],
        }
      : {}),
  });

  const text = extractText(response.content);
  if (!text) {
    throw new Error('Unexpected response format from Claude API');
  }

  return parseRating(text);
}

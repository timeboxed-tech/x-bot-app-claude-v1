import Anthropic from '@anthropic-ai/sdk';
import { systemPromptRepository } from '../repositories/systemPromptRepository.js';
import { DEFAULT_SYSTEM_PROMPTS } from '../constants/defaultSystemPrompts.js';

type PromptMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type GenerateTweetResult = {
  content: string;
  success: boolean;
  error?: string;
  prompt?: PromptMessage[];
};

const FALLBACK_SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPTS['tweet_generation'];
const FALLBACK_TWEAK_SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPTS['tweet_tweak'];
const FALLBACK_TIPS_SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPTS['tip_extraction'];

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

async function callClaude(
  client: Anthropic,
  promptOrMessages: string | Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
): Promise<string> {
  const messages = Array.isArray(promptOrMessages)
    ? promptOrMessages
    : [{ role: 'user' as const, content: promptOrMessages }];
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: systemPrompt,
    messages,
  });

  const text = extractText(response.content);
  if (text) return text;

  throw new Error('Unexpected response format from Claude API');
}

async function callClaudeWithWebSearch(
  client: Anthropic,
  promptOrMessages: string | Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
): Promise<string> {
  const messages = Array.isArray(promptOrMessages)
    ? promptOrMessages
    : [{ role: 'user' as const, content: promptOrMessages }];
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 3,
      } as Anthropic.Messages.WebSearchTool20250305,
    ],
  });

  const text = extractText(response.content);
  if (text) return text;

  throw new Error('Unexpected response format from Claude API');
}

async function callClaudeWithMessages(
  client: Anthropic,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxTokens = 300,
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  const text = extractText(response.content);
  if (text) return text;

  throw new Error('Unexpected response format from Claude API');
}

/** Maps behaviour outcomes to the corresponding system prompt key in the DB. */
export const OUTCOME_PROMPT_KEY_MAP: Record<string, string> = {
  write_post: 'tweet_generation',
  reply_to_post: 'reply_generation',
  like_post: 'like_evaluation',
  follow_account: 'follow_evaluation',
};

export async function generateTweet(
  prompt: string,
  tips?: string[],
  recentPosts?: string[],
  stylePrompt?: string,
  useWebSearch: boolean = true,
  systemPromptKey: string = 'tweet_generation',
): Promise<GenerateTweetResult> {
  const client = getClient();

  if (!client) {
    return {
      content: 'AI service not configured — set ANTHROPIC_API_KEY',
      success: false,
      error: 'ANTHROPIC_API_KEY not set',
    };
  }

  const fallback = DEFAULT_SYSTEM_PROMPTS[systemPromptKey] ?? FALLBACK_SYSTEM_PROMPT;
  let systemPrompt = await getCachedPrompt(systemPromptKey, fallback);
  // Append the bot's main prompt to the system prompt
  systemPrompt += `\n\n${prompt}`;
  if (tips && tips.length > 0) {
    systemPrompt += `\n\nRemember these tips from past feedback:\n${tips.map((t) => `- ${t}`).join('\n')}`;
  }
  if (recentPosts && recentPosts.length > 0) {
    systemPrompt += `\n\nHere are recent posts for this account — make sure your new tweet is fresh and different, not repetitive:\n${recentPosts.map((p) => `- ${p}`).join('\n')}`;
  }

  // Build user messages: behaviour prompt first (if provided), then the generation request
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (stylePrompt) {
    messages.push({ role: 'user', content: `Write in this style: ${stylePrompt}` });
    messages.push({
      role: 'assistant',
      content: 'Understood, I will write in that style.',
    });
  }
  messages.push({ role: 'user', content: 'Generate a tweet.' });

  // Capture the full prompt for storage
  const promptMessages: PromptMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as PromptMessage['role'], content: m.content })),
  ];

  const callFn = useWebSearch
    ? () => callClaudeWithWebSearch(client, messages, systemPrompt)
    : () => callClaude(client, messages, systemPrompt);

  try {
    const content = await callFn();
    return { content, success: true, prompt: promptMessages };
  } catch {
    // Retry once on failure
    try {
      const content = await callFn();
      return { content, success: true, prompt: promptMessages };
    } catch (retryErr: unknown) {
      const message = retryErr instanceof Error ? retryErr.message : String(retryErr);
      return { content: '', success: false, error: message };
    }
  }
}

export async function tweakPost(
  currentContent: string,
  feedback: string,
  previousMessages?: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<{ message: string; content: string }> {
  const client = getClient();
  if (!client) {
    throw new Error('AI service not configured — set ANTHROPIC_API_KEY');
  }

  const tweakSystemPrompt = await getCachedPrompt('tweet_tweak', FALLBACK_TWEAK_SYSTEM_PROMPT);

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  if (previousMessages && previousMessages.length > 0) {
    messages.push(...previousMessages);
  } else {
    messages.push({ role: 'user', content: `Current tweet:\n${currentContent}` });
  }

  messages.push({ role: 'user', content: feedback });

  const response = await callClaudeWithMessages(client, tweakSystemPrompt, messages, 600);

  const tweetMarker = '---TWEET---';
  const markerIndex = response.indexOf(tweetMarker);
  if (markerIndex === -1) {
    // Fallback: treat entire response as the tweet (backward compat)
    return { message: '', content: response };
  }

  const message = response.substring(0, markerIndex).trim();
  const content = response.substring(markerIndex + tweetMarker.length).trim();
  return { message, content };
}

export async function generateTips(
  conversation: Array<{ role: string; content: string }>,
): Promise<string[]> {
  const client = getClient();
  if (!client) {
    throw new Error('AI service not configured — set ANTHROPIC_API_KEY');
  }

  const tipsSystemPrompt = await getCachedPrompt('tip_extraction', FALLBACK_TIPS_SYSTEM_PROMPT);

  const formattedConversation = conversation
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join('\n\n');

  const result = await callClaude(
    client,
    `Here is the conversation:\n\n${formattedConversation}`,
    tipsSystemPrompt,
  );

  const tips = result
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line.length > 0);

  return tips;
}

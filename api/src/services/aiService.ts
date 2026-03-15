import Anthropic from '@anthropic-ai/sdk';

type GenerateTweetResult = {
  content: string;
  success: boolean;
  error?: string;
};

const SYSTEM_PROMPT = `You are a social media expert and skilled copywriter. Given a user's prompt, research and consider relevant topics, trends, and context, then draft a single tweet.

Rules:
- The tweet MUST be under 280 characters
- Make it engaging, authentic-sounding, and conversational
- Do not use hashtags excessively — one or two at most
- Do not include quotation marks around the tweet
- Output ONLY the tweet text, nothing else`;

const TWEAK_SYSTEM_PROMPT = `You are a collaborative social media editor helping refine a tweet. Have a natural conversation with the user — explain your changes, ask clarifying questions, suggest alternatives, and be a helpful creative partner.

IMPORTANT: Always end your response with the revised tweet on its own line after the marker "---TWEET---". The tweet must be under 280 characters.

Example format:
Great idea to make it punchier! I shortened the opening and added a hook question at the end. Want me to try a different angle?

---TWEET---
The actual revised tweet text here`;

const TIPS_SYSTEM_PROMPT = `Analyze this conversation where a user refined a tweet draft. Extract 1-3 concise tips/preferences that should guide future tweet generation for this account. Each tip should be a single sentence. Output only the tips, one per line.`;

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

async function callClaude(
  client: Anthropic,
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: systemPrompt ?? SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = response.content[0];
  if (block.type === 'text') {
    return block.text.trim();
  }

  throw new Error('Unexpected response format from Claude API');
}

async function callClaudeWithMessages(
  client: Anthropic,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxTokens = 300,
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  const block = response.content[0];
  if (block.type === 'text') {
    return block.text.trim();
  }

  throw new Error('Unexpected response format from Claude API');
}

export async function generateTweet(
  prompt: string,
  tips?: string[],
  recentPosts?: string[],
  stylePrompt?: string,
): Promise<GenerateTweetResult> {
  const client = getClient();

  if (!client) {
    return {
      content: 'AI service not configured \u2014 set ANTHROPIC_API_KEY',
      success: false,
      error: 'ANTHROPIC_API_KEY not set',
    };
  }

  let systemPrompt = SYSTEM_PROMPT;
  if (tips && tips.length > 0) {
    systemPrompt += `\n\nRemember these tips from past feedback:\n${tips.map((t) => `- ${t}`).join('\n')}`;
  }
  if (recentPosts && recentPosts.length > 0) {
    systemPrompt += `\n\nHere are recent posts for this account — make sure your new tweet is fresh and different, not repetitive:\n${recentPosts.map((p) => `- ${p}`).join('\n')}`;
  }
  if (stylePrompt) {
    systemPrompt += `\n\nWrite in this style: ${stylePrompt}`;
  }

  // First attempt
  try {
    const content = await callClaude(client, prompt, systemPrompt);
    return { content, success: true };
  } catch {
    // Retry once on failure
    try {
      const content = await callClaude(client, prompt, systemPrompt);
      return { content, success: true };
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
    throw new Error('AI service not configured \u2014 set ANTHROPIC_API_KEY');
  }

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  if (previousMessages && previousMessages.length > 0) {
    messages.push(...previousMessages);
  } else {
    messages.push({ role: 'user', content: `Current tweet:\n${currentContent}` });
  }

  messages.push({ role: 'user', content: feedback });

  const response = await callClaudeWithMessages(client, TWEAK_SYSTEM_PROMPT, messages, 600);

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
    throw new Error('AI service not configured \u2014 set ANTHROPIC_API_KEY');
  }

  const formattedConversation = conversation
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join('\n\n');

  const result = await callClaude(
    client,
    `Here is the conversation:\n\n${formattedConversation}`,
    TIPS_SYSTEM_PROMPT,
  );

  const tips = result
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line.length > 0);

  return tips;
}

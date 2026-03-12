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

async function callClaude(client: Anthropic, prompt: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = response.content[0];
  if (block.type === 'text') {
    return block.text.trim();
  }

  throw new Error('Unexpected response format from Claude API');
}

export async function generateTweet(prompt: string): Promise<GenerateTweetResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      content: 'AI service not configured \u2014 set ANTHROPIC_API_KEY',
      success: false,
      error: 'ANTHROPIC_API_KEY not set',
    };
  }

  const client = new Anthropic({ apiKey });

  // First attempt
  try {
    const content = await callClaude(client, prompt);
    return { content, success: true };
  } catch {
    // Retry once on failure
    try {
      const content = await callClaude(client, prompt);
      return { content, success: true };
    } catch (retryErr: unknown) {
      const message = retryErr instanceof Error ? retryErr.message : String(retryErr);
      return { content: '', success: false, error: message };
    }
  }
}

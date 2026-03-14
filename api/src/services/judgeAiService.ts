import Anthropic from '@anthropic-ai/sdk';

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

function buildSystemPrompt(name: string, personalityPrompt: string): string {
  return `You are ${name}. ${personalityPrompt}. \nReview the following tweet draft. Consider originality and whether it feels repetitive compared to recent posts. Provide a concise opinion (2-3 sentences max) and rate it 1-5.\nFormat your response as: your opinion text, then on a new line exactly "Rating: X/5"`;
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

export async function reviewPostWithJudge(
  judgeName: string,
  judgePrompt: string,
  postContent: string,
  recentPosts?: string[],
): Promise<{ opinion: string; rating: number }> {
  const client = getClient();
  if (!client) {
    return {
      opinion: 'AI service not configured -- set ANTHROPIC_API_KEY',
      rating: 3,
    };
  }

  const systemPrompt = buildSystemPrompt(judgeName, judgePrompt);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content:
          recentPosts && recentPosts.length > 0
            ? `Tweet to review:\n${postContent}\n\nRecent posts from this account for context (consider repetition):\n${recentPosts.map((p) => '- ' + p).join('\n')}`
            : postContent,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== 'text') {
    throw new Error('Unexpected response format from Claude API');
  }

  return parseRating(block.text.trim());
}

import Anthropic from '@anthropic-ai/sdk';

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

function buildSystemPrompt(name: string, personalityPrompt: string): string {
  return `You are ${name}. ${personalityPrompt}. \nReview the following tweet draft. Evaluate it on the following criteria:\n1. Originality — does it feel repetitive compared to recent posts?\n2. Timeliness & Relevance — does the post reference current events, recent news, or up-to-date facts? Flag any references to outdated news, old events, deprecated technologies, or information that is no longer accurate. A post that presents stale information as if it were new should be scored lower.\n3. AI Transparency — if any sentence describes the research process, explains why the topic was chosen, or reveals how the post was generated (e.g. "I found this interesting because...", "After researching...", "This caught my attention..."), heavily mark down the post. This is a clear sign of AI generation and should result in a very low score.\nIf timeliness is a concern, explicitly mention it in your opinion (e.g. "This references news from [date/period] which is no longer timely").\nProvide a concise opinion (2-3 sentences max) and rate it 1-5.\nFormat your response as: your opinion text, then on a new line exactly "Rating: X/5"`;
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

  const systemPrompt = buildSystemPrompt(judgeName, judgePrompt);

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

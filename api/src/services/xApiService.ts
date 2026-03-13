import { xOAuthService } from './xOAuthService.js';
import { botRepository } from '../repositories/botRepository.js';

const TWITTER_TWEET_URL = 'https://api.twitter.com/2/tweets';

export async function publishTweet(
  content: string,
  accessToken: string,
  refreshToken: string,
  botId?: string,
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  try {
    let token = accessToken;

    let response = await fetch(TWITTER_TWEET_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: content }),
    });

    // If 401, try refreshing the token
    if (response.status === 401 && refreshToken) {
      try {
        const refreshed = await xOAuthService.refreshAccessToken(refreshToken);
        token = refreshed.accessToken;

        // Persist new tokens
        if (botId) {
          await botRepository.update(botId, {
            xAccessToken: refreshed.accessToken,
            xAccessSecret: refreshed.refreshToken,
          });
        }

        // Retry with new token
        response = await fetch(TWITTER_TWEET_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: content }),
        });
      } catch (refreshErr) {
        const msg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
        return { success: false, error: `Token refresh failed: ${msg}` };
      }
    }

    if (!response.ok) {
      const text = await response.text();

      if (response.status === 429) {
        return { success: false, error: `Rate limited: ${text}` };
      }

      return { success: false, error: `X API error ${response.status}: ${text}` };
    }

    const data = (await response.json()) as { data?: { id?: string } };
    const tweetId = data?.data?.id;

    return { success: true, tweetId: tweetId ?? undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

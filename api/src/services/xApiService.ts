import { xOAuthService } from './xOAuthService.js';
import { botRepository } from '../repositories/botRepository.js';

const TWITTER_TWEET_URL = 'https://api.twitter.com/2/tweets';
const TWITTER_SEARCH_URL = 'https://api.twitter.com/2/tweets/search/recent';
const TWITTER_ME_URL = 'https://api.twitter.com/2/users/me';

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

export type SearchTweetResult = {
  id: string;
  text: string;
  authorId?: string;
  authorUsername?: string;
  publicMetrics?: {
    likeCount: number;
    retweetCount: number;
    replyCount: number;
  };
};

/**
 * Search recent tweets on X using the v2 search endpoint.
 */
export async function searchTweets(
  query: string,
  accessToken: string,
  refreshToken: string,
  botId?: string,
  maxResults: number = 10,
): Promise<{ success: boolean; tweets?: SearchTweetResult[]; error?: string }> {
  try {
    let token = accessToken;

    const params = new URLSearchParams({
      query,
      max_results: String(Math.min(Math.max(maxResults, 10), 100)),
      'tweet.fields': 'author_id,public_metrics',
      expansions: 'author_id',
      'user.fields': 'username',
    });

    let response = await fetch(`${TWITTER_SEARCH_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // If 401, try refreshing the token
    if (response.status === 401 && refreshToken) {
      try {
        const refreshed = await xOAuthService.refreshAccessToken(refreshToken);
        token = refreshed.accessToken;

        if (botId) {
          await botRepository.update(botId, {
            xAccessToken: refreshed.accessToken,
            xAccessSecret: refreshed.refreshToken,
          });
        }

        response = await fetch(`${TWITTER_SEARCH_URL}?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (refreshErr) {
        const msg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
        return { success: false, error: `Token refresh failed: ${msg}` };
      }
    }

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `X API search error ${response.status}: ${text}` };
    }

    const data = (await response.json()) as {
      data?: Array<{
        id: string;
        text: string;
        author_id?: string;
        public_metrics?: {
          like_count: number;
          retweet_count: number;
          reply_count: number;
        };
      }>;
      includes?: {
        users?: Array<{ id: string; username: string }>;
      };
    };

    if (!data.data || data.data.length === 0) {
      return { success: true, tweets: [] };
    }

    // Build username lookup from includes
    const userMap = new Map<string, string>();
    if (data.includes?.users) {
      for (const user of data.includes.users) {
        userMap.set(user.id, user.username);
      }
    }

    const tweets: SearchTweetResult[] = data.data.map((t) => ({
      id: t.id,
      text: t.text,
      authorId: t.author_id,
      authorUsername: t.author_id ? userMap.get(t.author_id) : undefined,
      publicMetrics: t.public_metrics
        ? {
            likeCount: t.public_metrics.like_count,
            retweetCount: t.public_metrics.retweet_count,
            replyCount: t.public_metrics.reply_count,
          }
        : undefined,
    }));

    return { success: true, tweets };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Get the authenticated user's X user ID.
 */
export async function getAuthenticatedUserId(
  accessToken: string,
  refreshToken: string,
  botId?: string,
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    let token = accessToken;

    let response = await fetch(TWITTER_ME_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401 && refreshToken) {
      try {
        const refreshed = await xOAuthService.refreshAccessToken(refreshToken);
        token = refreshed.accessToken;

        if (botId) {
          await botRepository.update(botId, {
            xAccessToken: refreshed.accessToken,
            xAccessSecret: refreshed.refreshToken,
          });
        }

        response = await fetch(TWITTER_ME_URL, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (refreshErr) {
        const msg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
        return { success: false, error: `Token refresh failed: ${msg}` };
      }
    }

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `X API error ${response.status}: ${text}` };
    }

    const data = (await response.json()) as { data?: { id?: string } };
    return { success: true, userId: data?.data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Like a tweet via X API v2.
 */
export async function likeTweet(
  tweetId: string,
  accessToken: string,
  refreshToken: string,
  botId?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    let token = accessToken;

    // First, get the authenticated user's ID
    const meResult = await getAuthenticatedUserId(token, refreshToken, botId);
    if (!meResult.success || !meResult.userId) {
      return { success: false, error: `Failed to get user ID: ${meResult.error ?? 'unknown'}` };
    }

    const likeUrl = `https://api.twitter.com/2/users/${meResult.userId}/likes`;

    let response = await fetch(likeUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tweet_id: tweetId }),
    });

    // If 401, try refreshing the token
    if (response.status === 401 && refreshToken) {
      try {
        const refreshed = await xOAuthService.refreshAccessToken(refreshToken);
        token = refreshed.accessToken;

        if (botId) {
          await botRepository.update(botId, {
            xAccessToken: refreshed.accessToken,
            xAccessSecret: refreshed.refreshToken,
          });
        }

        response = await fetch(likeUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tweet_id: tweetId }),
        });
      } catch (refreshErr) {
        const msg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
        return { success: false, error: `Token refresh failed: ${msg}` };
      }
    }

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `X API like error ${response.status}: ${text}` };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

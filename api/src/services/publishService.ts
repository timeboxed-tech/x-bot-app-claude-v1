import { publishTweet, likeTweet } from './xApiService.js';

/**
 * Check if a post is a like_post outcome by inspecting its metadata.
 */
export function isLikePostDraft(post: {
  metadata?: string | null;
  generationPrompt?: string | null;
}): boolean {
  if (post.metadata) {
    try {
      const meta = JSON.parse(post.metadata);
      if (meta.outcome === 'like_post') return true;
    } catch {
      // ignore parse errors
    }
  }
  if (post.generationPrompt) {
    try {
      const gen = JSON.parse(post.generationPrompt);
      if (gen.outcome === 'like_post') return true;
    } catch {
      // ignore parse errors
    }
  }
  return false;
}

/**
 * Handle publishing a like_post draft: like each tweet via X API.
 */
export async function handleLikePostPublish(
  post: { id: string; metadata?: string | null; content: string },
  bot: { id: string; xAccessToken: string; xAccessSecret: string; xAccountHandle: string },
): Promise<{
  success: boolean;
  likedCount: number;
  totalCount: number;
  error?: string;
  updatedMetadata?: string;
}> {
  let tweetIds: string[] = [];

  // Try to get tweet IDs from metadata
  if (post.metadata) {
    try {
      const meta = JSON.parse(post.metadata);
      if (Array.isArray(meta.tweetIds)) {
        tweetIds = meta.tweetIds;
      }
    } catch {
      // fall through to content parsing
    }
  }

  // Fallback: parse [tweet:ID] references from content
  if (tweetIds.length === 0) {
    const tweetIdRegex = /\[tweet:(\d+)\]/g;
    let match;
    while ((match = tweetIdRegex.exec(post.content)) !== null) {
      tweetIds.push(match[1]);
    }
  }

  if (tweetIds.length === 0) {
    return {
      success: false,
      likedCount: 0,
      totalCount: 0,
      error: 'No tweet IDs found in post metadata or content',
    };
  }

  let likedCount = 0;
  const errors: string[] = [];

  for (const tweetId of tweetIds) {
    try {
      const result = await likeTweet(tweetId, bot.xAccessToken, bot.xAccessSecret, bot.id);
      if (result.success) {
        likedCount++;
      } else {
        const errorMsg = `Failed to like tweet ${tweetId}: ${result.error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    } catch (err) {
      const errorMsg = `Error liking tweet ${tweetId}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  // Update metadata with results
  let updatedMetadata: string | undefined;
  try {
    const existingMeta = post.metadata ? JSON.parse(post.metadata) : {};
    updatedMetadata = JSON.stringify({
      ...existingMeta,
      publishResults: {
        likedCount,
        totalCount: tweetIds.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch {
    updatedMetadata = undefined;
  }

  return {
    success: likedCount > 0 || tweetIds.length === 0,
    likedCount,
    totalCount: tweetIds.length,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    updatedMetadata,
  };
}

/**
 * Publish a single post immediately (write_post or like_post).
 * Returns the result without updating the database.
 */
export async function publishPostNow(
  post: { id: string; content: string; metadata?: string | null; generationPrompt?: string | null },
  bot: { id: string; xAccessToken: string; xAccessSecret: string; xAccountHandle: string },
): Promise<{
  success: boolean;
  error?: string;
  updatedMetadata?: string;
}> {
  const isLike = isLikePostDraft(post);

  if (isLike) {
    const result = await handleLikePostPublish(post, bot);
    if (result.success) {
      return { success: true, updatedMetadata: result.updatedMetadata };
    }
    return { success: false, error: result.error };
  }

  // Regular write_post
  const result = await publishTweet(post.content, bot.xAccessToken, bot.xAccessSecret, bot.id);
  if (result.success) {
    return { success: true };
  }
  return { success: false, error: result.error };
}

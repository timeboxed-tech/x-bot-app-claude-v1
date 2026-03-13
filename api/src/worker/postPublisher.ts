import { postRepository } from '../repositories/postRepository.js';
import { publishTweet } from '../services/xApiService.js';

const POLL_INTERVAL_MS = parseInt(process.env.POST_PUBLISHER_POLL_INTERVAL_MS || '30000', 10);
const MAX_RETRIES = 3;

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let running = false;

// In-memory retry counter: postId -> failure count
const retryCounts = new Map<string, number>();

async function publishPosts(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const posts = await postRepository.findScheduledReady(20);

    for (const post of posts) {
      // Skip posts that have exceeded retry limit
      const currentRetries = retryCounts.get(post.id) ?? 0;
      if (currentRetries >= MAX_RETRIES) {
        console.warn(
          `[postPublisher] Post ${post.id} has reached max retries (${MAX_RETRIES}), skipping`,
        );
        continue;
      }

      const bot = post.bot;
      const result = await publishTweet(post.content, bot.xAccessToken, bot.xAccessSecret);

      if (result.success) {
        await postRepository.update(post.id, {
          status: 'published',
          publishedAt: new Date(),
        });

        // Clean up retry counter on success
        retryCounts.delete(post.id);

        console.log(
          `[postPublisher] Published post ${post.id} as tweet ${result.tweetId ?? 'unknown'}`,
        );
      } else {
        const newCount = currentRetries + 1;
        retryCounts.set(post.id, newCount);

        console.error(
          `[postPublisher] Failed to publish post ${post.id} (attempt ${newCount}/${MAX_RETRIES}): ${result.error}`,
        );

        if (newCount >= MAX_RETRIES) {
          await postRepository.update(post.id, { status: 'discarded' });
          retryCounts.delete(post.id);
          console.error(
            `[postPublisher] Post ${post.id} discarded after ${MAX_RETRIES} failed attempts: ${result.error}`,
          );
        }
      }
    }
  } catch (err) {
    console.error('[postPublisher] Error polling for scheduled posts:', err);
  } finally {
    running = false;
  }
}

export function start(pollIntervalMs?: number): void {
  const interval = pollIntervalMs ?? POLL_INTERVAL_MS;
  console.log(`[postPublisher] Starting with poll interval ${interval}ms`);
  void publishPosts();
  intervalHandle = setInterval(() => void publishPosts(), interval);
}

export function stop(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  console.log('[postPublisher] Stopped');
}

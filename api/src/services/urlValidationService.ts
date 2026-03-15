import { postRepository } from '../repositories/postRepository.js';

const URL_REGEX = /https?:\/\/[^\s)>\]"]+/g;
const REQUEST_TIMEOUT_MS = 5000;

export type UrlValidationResult = {
  url: string;
  valid: boolean;
  reason?: string;
};

export function extractUrls(text: string): string[] {
  return [...text.matchAll(URL_REGEX)].map((m) => m[0]);
}

export async function validateUrls(urls: string[]): Promise<UrlValidationResult[]> {
  return Promise.all(urls.map((url) => validateSingleUrl(url)));
}

async function validateSingleUrl(url: string): Promise<UrlValidationResult> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: 'follow',
    });

    // If HEAD is not allowed, fallback to GET
    if (response.status === 405) {
      const getResponse = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        redirect: 'follow',
      });
      if (getResponse.status >= 200 && getResponse.status < 400) {
        return { url, valid: true };
      }
      return { url, valid: false, reason: `HTTP ${getResponse.status}` };
    }

    if (response.status >= 200 && response.status < 400) {
      return { url, valid: true };
    }

    return { url, valid: false, reason: `HTTP ${response.status}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('timeout') || message.includes('TimeoutError')) {
      return { url, valid: false, reason: 'Timeout' };
    }
    if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
      return { url, valid: false, reason: 'DNS failure' };
    }
    return { url, valid: false, reason: message };
  }
}

export async function checkAndFlagPost(postId: string): Promise<void> {
  const post = await postRepository.findById(postId);
  if (!post) return;

  const urls = extractUrls(post.content);
  if (urls.length === 0) return;

  const results = await validateUrls(urls);
  const invalid = results.filter((r) => !r.valid);

  if (invalid.length > 0) {
    const reasons = invalid.map((r) => `Invalid URL: ${r.url} (${r.reason})`);
    await postRepository.flagPost(postId, reasons);
  }
}

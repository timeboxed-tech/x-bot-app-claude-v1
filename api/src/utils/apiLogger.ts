import { prisma } from './prisma.js';

const MAX_BODY_LENGTH = 10000; // Truncate large bodies

function truncate(str: string | null | undefined, maxLen = MAX_BODY_LENGTH): string | null {
  if (!str) return null;
  return str.length > maxLen ? str.slice(0, maxLen) + '...[truncated]' : str;
}

function serializeHeaders(headers: Record<string, string> | Headers | undefined): string | null {
  if (!headers) return null;
  const obj: Record<string, string> = {};
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      obj[key] = value;
    });
  } else {
    for (const [key, value] of Object.entries(headers)) {
      obj[key] = value;
    }
  }
  return JSON.stringify(obj);
}

export async function logApiCall(entry: {
  provider: string;
  method: string;
  url: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string | null;
  responseStatus?: number;
  responseHeaders?: Headers;
  responseBody?: string | null;
  durationMs?: number;
  error?: string | null;
}): Promise<void> {
  try {
    await prisma.apiLog.create({
      data: {
        provider: entry.provider,
        method: entry.method,
        url: entry.url,
        requestHeaders: serializeHeaders(entry.requestHeaders),
        requestBody: truncate(entry.requestBody),
        responseStatus: entry.responseStatus ?? null,
        responseHeaders: serializeHeaders(entry.responseHeaders),
        responseBody: truncate(entry.responseBody),
        durationMs: entry.durationMs ?? null,
        error: entry.error ?? null,
      },
    });
  } catch {
    // Don't let logging failures break the app
    console.error('[apiLogger] Failed to log API call');
  }
}

/**
 * Wrapper around fetch that logs the call.
 */
export async function loggedFetch(
  provider: string,
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const start = Date.now();
  let response: Response;
  let responseBody: string | null = null;

  try {
    response = await fetch(url, options);
    const durationMs = Date.now() - start;

    // Clone response to read body without consuming it
    const cloned = response.clone();
    try {
      responseBody = await cloned.text();
    } catch {
      responseBody = null;
    }

    void logApiCall({
      provider,
      method,
      url,
      requestHeaders: options.headers as Record<string, string> | undefined,
      requestBody: typeof options.body === 'string' ? options.body : null,
      responseStatus: response.status,
      responseHeaders: response.headers,
      responseBody,
      durationMs,
    });

    return response;
  } catch (err) {
    const durationMs = Date.now() - start;
    void logApiCall({
      provider,
      method,
      url,
      requestHeaders: options.headers as Record<string, string> | undefined,
      requestBody: typeof options.body === 'string' ? options.body : null,
      error: err instanceof Error ? err.message : String(err),
      durationMs,
    });
    throw err;
  }
}

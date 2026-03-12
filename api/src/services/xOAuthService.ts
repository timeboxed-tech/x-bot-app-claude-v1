import crypto from 'crypto';

const X_CONSUMER_KEY = process.env.X_CONSUMER_KEY || '';
const X_CONSUMER_SECRET = process.env.X_CONSUMER_SECRET || '';

const REQUEST_TOKEN_URL = 'https://api.twitter.com/oauth/request_token';
const ACCESS_TOKEN_URL = 'https://api.twitter.com/oauth/access_token';
const AUTHORIZE_URL = 'https://api.twitter.com/oauth/authorize';

// In-memory store for temporary request tokens (oauth_token -> oauth_token_secret + botId)
const requestTokenStore = new Map<
  string,
  { oauthTokenSecret: string; botId: string; userId: string; expiresAt: number }
>();

// Clean up expired tokens every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of requestTokenStore.entries()) {
      if (value.expiresAt < now) {
        requestTokenStore.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function buildOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string = '',
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');

  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(sortedParams)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;

  return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function buildAuthorizationHeader(params: Record<string, string>): string {
  const parts = Object.keys(params)
    .filter((key) => key.startsWith('oauth_'))
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(params[key])}"`)
    .join(', ');
  return `OAuth ${parts}`;
}

export async function getRequestToken(
  callbackUrl: string,
  botId: string,
  userId: string,
): Promise<{ redirectUrl: string }> {
  const oauthParams: Record<string, string> = {
    oauth_callback: callbackUrl,
    oauth_consumer_key: X_CONSUMER_KEY,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: generateTimestamp(),
    oauth_version: '1.0',
  };

  const signature = buildOAuthSignature('POST', REQUEST_TOKEN_URL, oauthParams, X_CONSUMER_SECRET);
  oauthParams.oauth_signature = signature;

  const response = await fetch(REQUEST_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: buildAuthorizationHeader(oauthParams),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get request token: ${text}`);
  }

  const body = await response.text();
  const params = new URLSearchParams(body);
  const oauthToken = params.get('oauth_token');
  const oauthTokenSecret = params.get('oauth_token_secret');

  if (!oauthToken || !oauthTokenSecret) {
    throw new Error('Invalid response from X: missing oauth_token');
  }

  // Store temporarily (10 minute expiry)
  requestTokenStore.set(oauthToken, {
    oauthTokenSecret,
    botId,
    userId,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const redirectUrl = `${AUTHORIZE_URL}?oauth_token=${oauthToken}`;
  return { redirectUrl };
}

export async function exchangeAccessToken(
  oauthToken: string,
  oauthVerifier: string,
): Promise<{
  accessToken: string;
  accessSecret: string;
  screenName: string;
  botId: string;
  userId: string;
}> {
  const stored = requestTokenStore.get(oauthToken);
  if (!stored) {
    throw new Error('Invalid or expired request token');
  }

  const { oauthTokenSecret, botId, userId } = stored;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: X_CONSUMER_KEY,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: generateTimestamp(),
    oauth_token: oauthToken,
    oauth_verifier: oauthVerifier,
    oauth_version: '1.0',
  };

  const signature = buildOAuthSignature(
    'POST',
    ACCESS_TOKEN_URL,
    oauthParams,
    X_CONSUMER_SECRET,
    oauthTokenSecret,
  );
  oauthParams.oauth_signature = signature;

  const response = await fetch(ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: buildAuthorizationHeader(oauthParams),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to exchange access token: ${text}`);
  }

  const body = await response.text();
  const params = new URLSearchParams(body);
  const accessToken = params.get('oauth_token');
  const accessSecret = params.get('oauth_token_secret');
  const screenName = params.get('screen_name');

  if (!accessToken || !accessSecret || !screenName) {
    throw new Error('Invalid response from X: missing access token data');
  }

  // Clean up request token
  requestTokenStore.delete(oauthToken);

  return {
    accessToken,
    accessSecret,
    screenName: `@${screenName}`,
    botId,
    userId,
  };
}

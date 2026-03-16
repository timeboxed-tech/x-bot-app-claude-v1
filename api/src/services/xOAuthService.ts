import crypto from 'node:crypto';
import { config } from '../config/index.js';

const TWITTER_AUTHORIZE_URL = 'https://twitter.com/i/oauth2/authorize';
const TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const TWITTER_ME_URL = 'https://api.twitter.com/2/users/me';

type PkceEntry = {
  codeVerifier: string;
  botId: string;
  createdAt: number;
};

// In-memory store for PKCE state → verifier mapping (10 min TTL)
const PKCE_TTL_MS = 10 * 60 * 1000;
const pkceStore = new Map<string, PkceEntry>();

function cleanExpired(): void {
  const now = Date.now();
  for (const [key, entry] of pkceStore.entries()) {
    if (now - entry.createdAt > PKCE_TTL_MS) {
      pkceStore.delete(key);
    }
  }
}

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function getClientId(): string {
  return process.env.X_CLIENT_ID || '';
}

function getClientSecret(): string {
  return process.env.X_CLIENT_SECRET || '';
}

function getCallbackUrl(): string {
  return `${config.app.baseUrl}/api/auth/x/callback`;
}

export const xOAuthService = {
  generateAuthUrl(botId: string): string {
    cleanExpired();

    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    pkceStore.set(state, {
      codeVerifier,
      botId,
      createdAt: Date.now(),
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: getClientId(),
      redirect_uri: getCallbackUrl(),
      scope: 'tweet.read tweet.write users.read like.read like.write offline.access',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${TWITTER_AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCode(
    code: string,
    state: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    screenName: string;
    botId: string;
  }> {
    cleanExpired();

    const entry = pkceStore.get(state);
    if (!entry) {
      throw new Error('Invalid or expired OAuth state');
    }
    pkceStore.delete(state);

    const clientId = getClientId();
    const clientSecret = getClientSecret();
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(TWITTER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: getCallbackUrl(),
        code_verifier: entry.codeVerifier,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${text}`);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      token_type: string;
    };

    if (!tokenData.access_token) {
      throw new Error('No access token in response');
    }

    // Fetch user info to get screen name
    const meResponse = await fetch(TWITTER_ME_URL, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    let screenName = '';
    if (meResponse.ok) {
      const meData = (await meResponse.json()) as {
        data?: { username?: string };
      };
      screenName = meData.data?.username ?? '';
    }

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? '',
      screenName,
      botId: entry.botId,
    };
  },

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const clientId = getClientId();
    const clientSecret = getClientSecret();
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(TWITTER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
    };
  },
};

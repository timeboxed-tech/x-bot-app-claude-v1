import { Request, Response } from 'express';
import * as xOAuthService from '../services/xOAuthService.js';
import * as botService from '../services/botService.js';

export async function initiateConnect(req: Request, res: Response): Promise<void> {
  try {
    const { botId } = req.query as { botId?: string };
    if (!botId) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'botId is required' },
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
      return;
    }

    const callbackUrl =
      process.env.X_OAUTH_CALLBACK_URL || 'http://localhost:3001/api/auth/x/callback';

    const { redirectUrl } = await xOAuthService.getRequestToken(
      callbackUrl,
      botId,
      req.user.userId,
    );

    res.json({ data: { redirectUrl } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({
      error: {
        code: 'OAUTH_ERROR',
        message: `Failed to initiate X OAuth: ${message}`,
      },
    });
  }
}

export async function handleCallback(req: Request, res: Response): Promise<void> {
  try {
    const { oauth_token, oauth_verifier } = req.query as {
      oauth_token?: string;
      oauth_verifier?: string;
    };

    if (!oauth_token || !oauth_verifier) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing oauth_token or oauth_verifier',
        },
      });
      return;
    }

    const { accessToken, accessSecret, screenName, botId, userId } =
      await xOAuthService.exchangeAccessToken(oauth_token, oauth_verifier);

    await botService.updateBotXCredentials(botId, userId, accessToken, accessSecret, screenName);

    // Redirect to dashboard after successful connection
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    res.redirect(`${appUrl}/dashboard?xConnected=true`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    res.redirect(`${appUrl}/dashboard?xError=${encodeURIComponent(message)}`);
  }
}

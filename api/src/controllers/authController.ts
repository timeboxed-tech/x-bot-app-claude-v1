import { Request, Response } from 'express';
import * as authService from '../services/authService.js';

export async function sendMagicLink(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body as { email?: string };
    if (!email || typeof email !== 'string') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Email is required' },
      });
      return;
    }

    const result = await authService.generateMagicLink(email);
    res.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'DOMAIN_NOT_ALLOWED') {
      res.status(403).json({
        error: {
          code: 'DOMAIN_NOT_ALLOWED',
          message: 'Email domain is not authorized',
        },
      });
      return;
    }
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate magic link' },
    });
  }
}

export async function verifyToken(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.query as { token?: string };
    if (!token) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Token is required' },
      });
      return;
    }

    const result = await authService.verifyToken(token);

    // Set httpOnly cookie
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ data: { user: result.user } });
  } catch {
    res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
    });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
      return;
    }

    const user = await authService.getCurrentUser(req.user.userId);
    res.json({ data: user });
  } catch {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'User not found' },
    });
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie('token');
  res.json({ data: { message: 'Logged out' } });
}

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService.js';
import { config } from '../config/index.js';
import { emailSchema } from '../utils/validation.js';

const SIGNUP_CODE = 'sister2026';

const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Invite code is required'),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

function setSessionCookie(res: Response, sessionToken: string): void {
  res.cookie(config.cookie.name, sessionToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax',
    maxAge: config.cookie.maxAge,
    path: '/',
  });
}

export const authController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name, code } = registerSchema.parse(req.body);
      if (code !== SIGNUP_CODE) {
        res.status(403).json({ error: 'Invalid invite code' });
        return;
      }
      const { user, sessionToken } = await authService.register(email, password, name);

      setSessionCookie(res, sessionToken);

      res.status(201).json({
        data: user,
      });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const { user, sessionToken } = await authService.login(email, password);

      setSessionCookie(res, sessionToken);

      res.status(200).json({
        data: user,
      });
    } catch (err) {
      next(err);
    }
  },

  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.clearCookie(config.cookie.name, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: config.isProduction ? 'none' : 'lax',
        path: '/',
      });

      res.status(200).json({
        data: { message: 'Logged out successfully' },
      });
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const user = await authService.getCurrentUser(userId);

      res.status(200).json({
        data: user,
      });
    } catch (err) {
      next(err);
    }
  },
};

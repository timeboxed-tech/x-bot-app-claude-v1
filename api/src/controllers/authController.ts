import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService.js';
import { config } from '../config/index.js';
import { emailSchema } from '../utils/validation.js';

const magicLinkSchema = z.object({
  email: emailSchema,
});

const verifyQuerySchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const authController = {
  async requestMagicLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = magicLinkSchema.parse(req.body);
      authService.validateEmailDomain(email);
      const url = authService.generateMagicLinkUrl(email);

      res.status(200).json({
        data: { url },
      });
    } catch (err) {
      next(err);
    }
  },

  async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = verifyQuerySchema.parse(req.query);
      const { sessionToken } = await authService.verifyAndCreateSession(token);

      res.cookie(config.cookie.name, sessionToken, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'lax',
        maxAge: config.cookie.maxAge,
        path: '/',
      });

      res.redirect(`${config.app.frontendUrl}/dashboard`);
    } catch (err) {
      next(err);
    }
  },

  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.clearCookie(config.cookie.name, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'lax',
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

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError } from '../utils/errors.js';

export type SessionPayload = {
  userId: string;
  email: string;
  type: 'session';
};

export type MagicLinkPayload = {
  email: string;
  type: 'magic-link';
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = req.cookies?.[config.cookie.name] as string | undefined;

    if (!token) {
      throw new UnauthorizedError('No session cookie provided');
    }

    const payload = jwt.verify(token, config.jwt.secret) as SessionPayload;

    if (payload.type !== 'session') {
      throw new UnauthorizedError('Invalid token type');
    }

    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      next(err);
      return;
    }
    next(new UnauthorizedError('Invalid or expired session'));
  }
}

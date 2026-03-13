import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { userRepository } from '../repositories/userRepository.js';
import { ValidationError, UnauthorizedError } from '../utils/errors.js';
import type { SessionPayload, MagicLinkPayload } from '../middleware/auth.js';

export const authService = {
  validateEmailDomain(email: string): void {
    const domain = email.split('@')[1];
    if (!domain || !config.allowedDomains.includes(domain)) {
      throw new ValidationError('Your email is not allowed');
    }
  },

  generateMagicLinkToken(email: string): string {
    const payload: MagicLinkPayload = { email, type: 'magic-link' };
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.magicLinkExpiresInSeconds,
    });
  },

  generateMagicLinkUrl(email: string): string {
    const token = this.generateMagicLinkToken(email);
    return `${config.app.baseUrl}/api/auth/verify?token=${token}`;
  },

  verifyMagicLinkToken(token: string): MagicLinkPayload {
    try {
      const payload = jwt.verify(token, config.jwt.secret) as MagicLinkPayload;
      if (payload.type !== 'magic-link') {
        throw new UnauthorizedError('Invalid token type');
      }
      return payload;
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Invalid or expired magic link');
    }
  },

  async verifyAndCreateSession(token: string) {
    const { email } = this.verifyMagicLinkToken(token);
    const user = await userRepository.upsertByEmail(email);

    const sessionPayload: SessionPayload = {
      userId: user.id,
      email: user.email,
      type: 'session',
    };

    const sessionToken = jwt.sign(sessionPayload, config.jwt.secret, {
      expiresIn: config.jwt.sessionExpiresInSeconds,
    });

    return { user, sessionToken };
  },

  async getCurrentUser(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    return user;
  },
};

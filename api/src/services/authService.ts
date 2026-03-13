import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { userRepository } from '../repositories/userRepository.js';
import { ValidationError, UnauthorizedError, ConflictError } from '../utils/errors.js';
import type { SessionPayload } from '../middleware/auth.js';

export const authService = {
  validateEmailDomain(email: string): void {
    const domain = email.split('@')[1];
    if (!domain || !config.allowedDomains.includes(domain)) {
      throw new ValidationError('Your email is not allowed');
    }
  },

  async register(email: string, password: string, name: string) {
    this.validateEmailDomain(email);

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userRepository.create(email, name, passwordHash);

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

  async login(email: string, password: string) {
    const user = await userRepository.findByEmailWithPassword(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.archivedAt) {
      throw new ValidationError('Your account has been archived');
    }

    const sessionPayload: SessionPayload = {
      userId: user.id,
      email: user.email,
      type: 'session',
    };

    const sessionToken = jwt.sign(sessionPayload, config.jwt.secret, {
      expiresIn: config.jwt.sessionExpiresInSeconds,
    });

    return {
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
      sessionToken,
    };
  },

  async getCurrentUser(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    return user;
  },
};

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories/userRepository.js';
import { paginationSchema, uuidSchema } from '../utils/validation.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

const updatePasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const userController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, pageSize } = paginationSchema.parse(req.query);
      const includeArchived = req.query.includeArchived === 'true';
      const { users, total } = await userRepository.findAll(page, pageSize, includeArchived);

      res.status(200).json({
        data: users,
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async updatePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = uuidSchema.parse(req.params.id);
      const { password } = updatePasswordSchema.parse(req.body);

      const existing = await userRepository.findById(id);
      if (!existing) {
        throw new NotFoundError('User not found');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await userRepository.updatePassword(id, passwordHash);

      res.status(200).json({
        data: user,
      });
    } catch (err) {
      next(err);
    }
  },

  async archive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userEmail?.endsWith('@thestartupfactory.tech')) {
        throw new ForbiddenError('Only @thestartupfactory.tech users can archive accounts');
      }

      const id = uuidSchema.parse(req.params.id);
      const existing = await userRepository.findById(id);
      if (!existing) {
        throw new NotFoundError('User not found');
      }

      const user = await userRepository.archive(id);
      res.status(200).json({ data: user });
    } catch (err) {
      next(err);
    }
  },

  async reinstate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userEmail?.endsWith('@thestartupfactory.tech')) {
        throw new ForbiddenError('Only @thestartupfactory.tech users can reinstate accounts');
      }

      const id = uuidSchema.parse(req.params.id);
      const existing = await userRepository.findById(id);
      if (!existing) {
        throw new NotFoundError('User not found');
      }

      const user = await userRepository.reinstate(id);
      res.status(200).json({ data: user });
    } catch (err) {
      next(err);
    }
  },
};

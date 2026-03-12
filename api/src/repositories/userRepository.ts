import { prisma } from '../utils/prisma.js';

export const userRepository = {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, createdAt: true },
    });
  },

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, createdAt: true },
    });
  },

  async upsertByEmail(email: string) {
    const name = email.split('@')[0];
    return prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name },
      select: { id: true, email: true, name: true, createdAt: true },
    });
  },
};

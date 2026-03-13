import { prisma } from '../utils/prisma.js';

const userSelect = { id: true, email: true, name: true, createdAt: true };

export const userRepository = {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: userSelect,
    });
  },

  async findByEmailWithPassword(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { ...userSelect, passwordHash: true },
    });
  },

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
  },

  async create(email: string, name: string, passwordHash: string) {
    return prisma.user.create({
      data: { email, name, passwordHash },
      select: userSelect,
    });
  },

  async findAll(page: number, pageSize: number) {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: userSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count(),
    ]);
    return { users, total };
  },

  async updatePassword(id: string, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: userSelect,
    });
  },
};

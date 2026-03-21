import { prisma } from '../utils/prisma.js';

const userSelect = {
  id: true,
  email: true,
  name: true,
  isAdmin: true,
  archivedAt: true,
  createdAt: true,
};

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

  async create(email: string, name: string, passwordHash: string, isAdmin = false) {
    return prisma.user.create({
      data: { email, name, passwordHash, isAdmin },
      select: userSelect,
    });
  },

  async setAdmin(id: string, isAdmin: boolean) {
    return prisma.user.update({
      where: { id },
      data: { isAdmin },
      select: userSelect,
    });
  },

  async findAll(page: number, pageSize: number, includeArchived = false) {
    const where = includeArchived ? {} : { archivedAt: null };
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);
    return { users, total };
  },

  async archive(id: string) {
    // Deactivate all bots when archiving user
    await prisma.bot.updateMany({
      where: { userId: id },
      data: { active: false },
    });
    return prisma.user.update({
      where: { id },
      data: { archivedAt: new Date() },
      select: userSelect,
    });
  },

  async reinstate(id: string) {
    return prisma.user.update({
      where: { id },
      data: { archivedAt: null },
      select: userSelect,
    });
  },

  async updatePassword(id: string, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: userSelect,
    });
  },
};

import { prisma } from '../utils/prisma.js';

export const postRepository = {
  async create(data: {
    botId: string;
    jobId: string;
    content: string;
    status: string;
    scheduledAt?: Date | null;
  }) {
    return prisma.post.create({
      data: {
        botId: data.botId,
        jobId: data.jobId,
        content: data.content,
        status: data.status,
        scheduledAt: data.scheduledAt ?? null,
      },
    });
  },

  async findById(id: string) {
    return prisma.post.findUnique({
      where: { id },
      include: { bot: true },
    });
  },

  async findByBotIds(
    botIds: string[],
    options: { status?: string; page: number; pageSize: number },
  ) {
    const where: { botId: { in: string[] }; status?: string } = {
      botId: { in: botIds },
    };
    if (options.status) {
      where.status = options.status;
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.post.count({ where }),
    ]);

    return { posts, total };
  },

  async findByStatus(status: string, limit = 50) {
    return prisma.post.findMany({
      where: { status },
      take: limit,
      orderBy: { scheduledAt: 'asc' },
    });
  },

  async findScheduledReady(limit = 50) {
    return prisma.post.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: new Date() },
        bot: { user: { archivedAt: null } },
      },
      take: limit,
      orderBy: { scheduledAt: 'asc' },
      include: { bot: true },
    });
  },

  async update(
    id: string,
    data: {
      content?: string;
      status?: string;
      rating?: number | null;
      scheduledAt?: Date | null;
      publishedAt?: Date | null;
    },
  ) {
    return prisma.post.update({
      where: { id },
      data,
    });
  },

  async updateStatus(
    id: string,
    status: string,
    extra?: { publishedAt?: Date; scheduledAt?: Date },
  ) {
    return prisma.post.update({
      where: { id },
      data: {
        status,
        ...extra,
      },
    });
  },
};

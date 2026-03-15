import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../utils/prisma.js';

type TxClient = Prisma.TransactionClient;

export const postRepository = {
  async create(data: {
    botId: string;
    jobId?: string;
    content: string;
    status: string;
    scheduledAt?: Date | null;
    behaviourPrompt?: string | null;
    behaviourTitle?: string | null;
  }) {
    return prisma.post.create({
      data: {
        botId: data.botId,
        jobId: data.jobId ?? null,
        content: data.content,
        status: data.status,
        scheduledAt: data.scheduledAt ?? null,
        behaviourPrompt: data.behaviourPrompt ?? null,
        behaviourTitle: data.behaviourTitle ?? null,
      },
    });
  },

  async findById(id: string) {
    return prisma.post.findUnique({
      where: { id },
      include: { bot: true },
    });
  },

  async findAll(options: { status?: string; page: number; pageSize: number }) {
    const where: { status?: string } = {};
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

  async findLastPublishedByBot(botId: string) {
    return prisma.post.findFirst({
      where: {
        botId,
        status: 'published',
        publishedAt: { not: null },
      },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    });
  },

  async findApprovedReady(limit = 50) {
    return prisma.post.findMany({
      where: {
        status: 'approved',
        flagged: false,
        bot: {
          postMode: 'with-approval',
          active: true,
          user: { archivedAt: null },
        },
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
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

  async countPublishedByBotSince(botId: string, since: Date) {
    return prisma.post.count({
      where: {
        botId,
        status: 'published',
        publishedAt: { gte: since },
      },
    });
  },

  async countRecentByBot(botId: string, hoursBack = 24) {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    return prisma.post.count({
      where: {
        botId,
        createdAt: { gte: since },
        status: { in: ['draft', 'scheduled', 'published', 'approved'] },
      },
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

  async delete(id: string) {
    return prisma.$transaction([
      prisma.postReview.deleteMany({ where: { postId: id } }),
      prisma.post.delete({ where: { id } }),
    ]);
  },

  async deleteDiscardedByBotIds(botIds: string[]) {
    const discardedPosts = await prisma.post.findMany({
      where: { botId: { in: botIds }, status: 'discarded' },
      select: { id: true },
    });
    const postIds = discardedPosts.map((p: { id: string }) => p.id);
    if (postIds.length === 0) return { count: 0 };
    return prisma.$transaction(async (tx: TxClient) => {
      await tx.postReview.deleteMany({ where: { postId: { in: postIds } } });
      return tx.post.deleteMany({ where: { id: { in: postIds } } });
    });
  },

  async deleteAllDiscarded() {
    const discardedPosts = await prisma.post.findMany({
      where: { status: 'discarded' },
      select: { id: true },
    });
    const postIds = discardedPosts.map((p: { id: string }) => p.id);
    if (postIds.length === 0) return { count: 0 };
    return prisma.$transaction(async (tx: TxClient) => {
      await tx.postReview.deleteMany({ where: { postId: { in: postIds } } });
      return tx.post.deleteMany({ where: { id: { in: postIds } } });
    });
  },

  async flagPost(id: string, reasons: string[]) {
    return prisma.post.update({
      where: { id },
      data: {
        flagged: true,
        flagReasons: { push: reasons },
      },
    });
  },

  async findRecentByBotId(botId: string, limit = 10) {
    return prisma.post.findMany({
      where: {
        botId,
        status: { in: ['draft', 'scheduled', 'published', 'approved'] },
      },
      select: { content: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};

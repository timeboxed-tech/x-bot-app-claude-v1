import { prisma } from '../utils/prisma.js';

export const postEvaluationRepository = {
  async findByPostId(postId: string) {
    return prisma.postEvaluation.findMany({
      where: { postId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findLatestByPostId(postId: string) {
    return prisma.postEvaluation.findFirst({
      where: { postId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(data: { postId: string; messages: string }) {
    return prisma.postEvaluation.create({
      data: {
        postId: data.postId,
        messages: data.messages,
      },
    });
  },

  async update(id: string, data: { messages: string }) {
    return prisma.postEvaluation.update({
      where: { id },
      data: { messages: data.messages },
    });
  },
};

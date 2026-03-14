import { prisma } from '../utils/prisma.js';

export const postReviewRepository = {
  async findByPostId(postId: string) {
    return prisma.postReview.findMany({
      where: { postId },
      include: { judge: true },
      orderBy: { createdAt: 'asc' },
    });
  },

  async create(data: { postId: string; judgeId: string; rating: number; opinion: string }) {
    return prisma.postReview.create({
      data: {
        postId: data.postId,
        judgeId: data.judgeId,
        rating: data.rating,
        opinion: data.opinion,
      },
      include: { judge: true },
    });
  },

  async delete(id: string) {
    return prisma.postReview.delete({
      where: { id },
    });
  },

  async createMany(
    reviews: Array<{ postId: string; judgeId: string; rating: number; opinion: string }>,
  ) {
    const created = await Promise.all(
      reviews.map((review) =>
        prisma.postReview.create({
          data: {
            postId: review.postId,
            judgeId: review.judgeId,
            rating: review.rating,
            opinion: review.opinion,
          },
          include: { judge: true },
        }),
      ),
    );
    return created;
  },
};

import { botRepository } from '../repositories/botRepository.js';
import { postRepository } from '../repositories/postRepository.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

type UpdatePostInput = {
  content?: string;
  rating?: number | null;
  status?: 'scheduled' | 'discarded';
  scheduledAt?: string | null;
};

export const postService = {
  async listPosts(userId: string | undefined, options: { status?: string; page: number; pageSize: number }) {
    if (!userId) {
      // Admin show-all: no bot scoping
      return postRepository.findAll(options);
    }

    const { bots } = await botRepository.findByUserId(userId, 1, 1000);
    const botIds = bots.map((b: { id: string }) => b.id);

    if (botIds.length === 0) {
      return { posts: [], total: 0 };
    }

    return postRepository.findByBotIds(botIds, options);
  },

  async updatePost(postId: string, userId: string, input: UpdatePostInput) {
    const post = await postRepository.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }
    if (post.bot.userId !== userId) {
      throw new ForbiddenError('You do not have access to this post');
    }

    // Validate status transitions
    if (post.status === 'published') {
      throw new ForbiddenError('Cannot modify a published post');
    }
    if (post.status === 'discarded') {
      throw new ForbiddenError('Cannot modify a discarded post');
    }

    // Validate content changes: only allowed on drafts
    if (input.content !== undefined && post.status !== 'draft') {
      throw new ValidationError('Content can only be edited on draft posts');
    }

    // Validate rating constraints: NOT allowed on discarded posts (already blocked above)
    if (input.rating !== undefined && input.rating !== null) {
      if (input.rating < 1 || input.rating > 5 || !Number.isInteger(input.rating)) {
        throw new ValidationError('Rating must be an integer between 1 and 5');
      }
    }

    // Validate status transition
    if (input.status) {
      const allowed = getAllowedTransitions(post.status);
      if (!allowed.includes(input.status)) {
        throw new ValidationError(`Cannot transition from '${post.status}' to '${input.status}'`);
      }
    }

    const updateData: {
      content?: string;
      status?: string;
      rating?: number | null;
      scheduledAt?: Date | null;
      publishedAt?: Date | null;
    } = {};

    if (input.content !== undefined) {
      updateData.content = input.content;
    }

    if (input.rating !== undefined) {
      updateData.rating = input.rating;
    }

    if (input.status === 'scheduled') {
      updateData.status = 'scheduled';
      updateData.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : new Date();
    } else if (input.status === 'discarded') {
      updateData.status = 'discarded';
    }

    return postRepository.update(postId, updateData);
  },
};

function getAllowedTransitions(currentStatus: string): string[] {
  switch (currentStatus) {
    case 'draft':
      return ['scheduled', 'discarded'];
    case 'scheduled':
      return ['discarded'];
    default:
      return [];
  }
}

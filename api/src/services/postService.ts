import { botRepository } from '../repositories/botRepository.js';
import { postRepository } from '../repositories/postRepository.js';
import { botTipRepository } from '../repositories/botTipRepository.js';
import { tweakPost, generateTips } from './aiService.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

type UpdatePostInput = {
  content?: string;
  rating?: number | null;
  status?: 'draft' | 'scheduled' | 'discarded' | 'approved';
  scheduledAt?: string | null;
};

export const postService = {
  async listPosts(
    userId: string | undefined,
    options: { status?: string; page: number; pageSize: number },
  ) {
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
    if (post.status === 'discarded' && input.status !== 'draft') {
      throw new ForbiddenError('Discarded posts can only be reinstated to draft');
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

      // Auto-approve: when a draft post from a with-approval bot is rated 4 or 5 (and not flagged)
      if (
        input.rating !== null &&
        input.rating >= 4 &&
        post.bot.postMode === 'with-approval' &&
        post.status === 'draft' &&
        !post.flagged &&
        !input.status // don't override an explicit status change
      ) {
        updateData.status = 'approved';
      }
    }

    if (input.status === 'approved') {
      updateData.status = 'approved';
    } else if (input.status === 'scheduled') {
      updateData.status = 'scheduled';
      updateData.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : new Date();
    } else if (input.status === 'discarded') {
      updateData.status = 'discarded';
    } else if (input.status === 'draft') {
      updateData.status = 'draft';
      updateData.scheduledAt = null;
    }

    return postRepository.update(postId, updateData);
  },

  async tweakPost(
    postId: string,
    userId: string,
    feedback: string,
    previousMessages?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ) {
    const post = await postRepository.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }
    if (post.bot.userId !== userId) {
      throw new ForbiddenError('You do not have access to this post');
    }
    if (post.status !== 'draft') {
      throw new ValidationError('Only draft posts can be tweaked');
    }

    const result = await tweakPost(post.content, feedback, previousMessages);
    return result;
  },

  async acceptTweak(
    postId: string,
    userId: string,
    content: string,
    conversation: Array<{ role: string; content: string }>,
  ) {
    const post = await postRepository.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }
    if (post.bot.userId !== userId) {
      throw new ForbiddenError('You do not have access to this post');
    }
    if (post.status !== 'draft') {
      throw new ValidationError('Only draft posts can be updated');
    }

    const updatedPost = await postRepository.update(postId, { content });

    // Generate tips from the conversation (max 10 per bot)
    let newTips: Array<{ id: string; botId: string; content: string; createdAt: Date }> = [];
    try {
      const existingCount = await botTipRepository.countByBotId(post.botId);
      const slotsAvailable = Math.max(0, 10 - existingCount);
      if (slotsAvailable > 0) {
        const tipStrings = await generateTips(conversation);
        const tipsToSave = tipStrings.slice(0, slotsAvailable);
        if (tipsToSave.length > 0) {
          newTips = await botTipRepository.createMany(
            tipsToSave.map((tipContent) => ({
              botId: post.botId,
              content: tipContent,
            })),
          );
        }
      }
    } catch {
      // Tips generation is best-effort; don't fail the accept
    }

    return { post: updatedPost, newTips };
  },

  async deletePost(postId: string, userId: string) {
    const post = await postRepository.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }
    if (post.bot.userId !== userId) {
      throw new ForbiddenError('You do not have access to this post');
    }
    if (post.status !== 'discarded') {
      throw new ValidationError('Only discarded posts can be deleted');
    }
    await postRepository.delete(postId);
  },

  async deleteAllDiscarded(userId: string | undefined) {
    if (!userId) {
      // Admin show-all: delete all discarded posts
      const result = await postRepository.deleteAllDiscarded();
      return result.count;
    }

    const { bots } = await botRepository.findByUserId(userId, 1, 1000);
    const botIds = bots.map((b: { id: string }) => b.id);

    if (botIds.length === 0) {
      return 0;
    }

    const result = await postRepository.deleteDiscardedByBotIds(botIds);
    return result.count;
  },
};

function getAllowedTransitions(currentStatus: string): string[] {
  switch (currentStatus) {
    case 'draft':
      return ['scheduled', 'discarded', 'approved'];
    case 'approved':
      return ['discarded', 'draft'];
    case 'scheduled':
      return ['discarded'];
    case 'discarded':
      return ['draft'];
    default:
      return [];
  }
}

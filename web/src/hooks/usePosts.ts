import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

export type PostStatus = 'draft' | 'published' | 'discarded' | 'approved' | 'failed';

export type Post = {
  id: string;
  botId: string;
  content: string;
  status: PostStatus;
  rating: number | null;
  flagged: boolean;
  flagReasons: string[];
  behaviourPrompt: string | null;
  behaviourTitle: string | null;
  generationPrompt?: string | null;
  metadata?: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PostListResponse = {
  data: Post[];
  meta: { page: number; pageSize: number; total: number };
};

type PostResponse = {
  data: Post;
  warning?: string;
};

type UpdatePostInput = {
  id: string;
  content?: string;
  status?: PostStatus;
  rating?: number | null;
  flagged?: boolean;
};

type PostCounts = {
  draft: number;
  approved: number;
  published: number;
  failed: number;
  discarded: number;
  total: number;
};

export function usePostCounts(showAll = false, botId?: string) {
  return useQuery({
    queryKey: queryKeys.posts.counts(showAll, botId),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (showAll) {
        params.showAll = 'true';
      }
      if (botId) {
        params.botId = botId;
      }
      const response = await apiClient.get<{ data: PostCounts }>('/posts/counts', { params });
      return response.data.data;
    },
  });
}

export function usePosts(
  status?: string,
  page = 1,
  pageSize = 10,
  showAll = false,
  botId?: string,
) {
  return useQuery({
    queryKey: queryKeys.posts.list(status, page, showAll, botId),
    queryFn: async () => {
      const params: Record<string, string | number | boolean> = { page, pageSize };
      if (status) {
        params.status = status;
      }
      if (showAll) {
        params.showAll = 'true';
      }
      if (botId) {
        params.botId = botId;
      }
      const response = await apiClient.get<PostListResponse>('/posts', {
        params,
      });
      return response.data;
    },
  });
}

export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdatePostInput) => {
      const response = await apiClient.patch<PostResponse>(`/posts/${id}`, input);
      return { post: response.data.data, warning: response.data.warning };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}

type TweakPostInput = {
  postId: string;
  feedback: string;
  previousMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
};

type TweakPostResponse = {
  data: { message: string; content: string };
};

export function useTweakPost() {
  return useMutation({
    mutationFn: async ({ postId, feedback, previousMessages }: TweakPostInput) => {
      const response = await apiClient.post<TweakPostResponse>(`/posts/${postId}/tweak`, {
        feedback,
        previousMessages,
      });
      return response.data.data;
    },
  });
}

type BotTip = {
  id: string;
  botId: string;
  content: string;
  createdAt: string;
};

type AcceptTweakInput = {
  postId: string;
  content: string;
  conversation: Array<{ role: string; content: string }>;
};

type AcceptTweakResponse = {
  data: { post: Post; newTips: BotTip[] };
};

export function useAcceptTweak() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, content, conversation }: AcceptTweakInput) => {
      const response = await apiClient.post<AcceptTweakResponse>(`/posts/${postId}/accept-tweak`, {
        content,
        conversation,
      });
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}

export function usePublishPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const response = await apiClient.post<PostResponse>(`/posts/${postId}/publish`);
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      await apiClient.delete(`/posts/${postId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}

export function useDeleteAllDiscarded() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (showAll: boolean) => {
      const params: Record<string, string> = {};
      if (showAll) {
        params.showAll = 'true';
      }
      const response = await apiClient.delete<{ data: { count: number } }>('/posts/discarded', {
        params,
      });
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}

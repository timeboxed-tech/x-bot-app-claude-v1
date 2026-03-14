import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'discarded';

export type Post = {
  id: string;
  botId: string;
  content: string;
  status: PostStatus;
  rating: number | null;
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
};

type UpdatePostInput = {
  id: string;
  content?: string;
  status?: PostStatus;
  rating?: number | null;
};

export function usePosts(status?: string, page = 1, pageSize = 10, showAll = false) {
  return useQuery({
    queryKey: queryKeys.posts.list(status, page, showAll),
    queryFn: async () => {
      const params: Record<string, string | number | boolean> = { page, pageSize };
      if (status) {
        params.status = status;
      }
      if (showAll) {
        params.showAll = 'true';
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
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}

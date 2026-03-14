import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

export type Judge = {
  id: string;
  name: string;
  prompt: string;
  createdAt: string;
  archivedAt: string | null;
};

export type BotJudge = {
  id: string;
  botId: string;
  judgeId: string;
  createdAt: string;
  judge: Judge;
};

export type PostReview = {
  id: string;
  postId: string;
  judgeId: string;
  rating: number;
  opinion: string;
  createdAt: string;
  judge: Judge;
};

type JudgeListResponse = {
  data: Judge[];
};

type BotJudgeListResponse = {
  data: BotJudge[];
};

type PostReviewListResponse = {
  data: PostReview[];
};

// Judge CRUD
export function useJudges() {
  return useQuery({
    queryKey: queryKeys.judges.list,
    queryFn: async () => {
      const response = await apiClient.get<JudgeListResponse>('/judges');
      return response.data.data;
    },
  });
}

export function useCreateJudge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; prompt: string }) => {
      const response = await apiClient.post<{ data: Judge }>('/judges', input);
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.judges.list });
    },
  });
}

export function useUpdateJudge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; prompt?: string }) => {
      const response = await apiClient.patch<{ data: Judge }>(`/judges/${id}`, input);
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.judges.list });
    },
  });
}

export function useArchiveJudge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.patch<{ data: Judge }>(`/judges/${id}/archive`);
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.judges.list });
    },
  });
}

export function useReactivateJudge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.patch<{ data: Judge }>(`/judges/${id}/reactivate`);
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.judges.list });
    },
  });
}

export function useDeleteJudge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/judges/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.judges.list });
    },
  });
}

// Bot-Judge assignment
export function useBotJudges(botId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.bots.judges(botId ?? ''),
    queryFn: async () => {
      const response = await apiClient.get<BotJudgeListResponse>(`/bots/${botId}/judges`);
      return response.data.data;
    },
    enabled: !!botId,
  });
}

export function useAssignJudge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ botId, judgeId }: { botId: string; judgeId: string }) => {
      const response = await apiClient.post<{ data: BotJudge }>(`/bots/${botId}/judges`, {
        judgeId,
      });
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bots.judges(variables.botId),
      });
    },
  });
}

export function useRemoveJudge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ botId, judgeId }: { botId: string; judgeId: string }) => {
      await apiClient.delete(`/bots/${botId}/judges/${judgeId}`);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bots.judges(variables.botId),
      });
    },
  });
}

// Post reviews
export function usePostReviews(postId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.posts.reviews(postId ?? ''),
    queryFn: async () => {
      const response = await apiClient.get<PostReviewListResponse>(`/posts/${postId}/reviews`);
      return response.data.data;
    },
    enabled: !!postId,
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, reviewId }: { postId: string; reviewId: string }) => {
      await apiClient.delete(`/posts/${postId}/reviews/${reviewId}`);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.posts.reviews(variables.postId),
      });
    },
  });
}

export function useRequestReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const response = await apiClient.post<PostReviewListResponse>(`/posts/${postId}/review`);
      return response.data.data;
    },
    onSuccess: (_data, postId) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.posts.reviews(postId),
      });
    },
  });
}

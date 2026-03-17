import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

export type EvalMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type PostEvaluation = {
  id: string;
  postId: string;
  messages: EvalMessage[];
  createdAt: string;
  updatedAt: string;
};

type EvaluateInput = {
  postId: string;
  message: string;
  evaluationId?: string;
};

type EvaluateResponse = {
  data: {
    evaluationId: string;
    messages: EvalMessage[];
  };
};

export function useEvaluatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, message, evaluationId }: EvaluateInput) => {
      const response = await apiClient.post<EvaluateResponse>(`/posts/${postId}/evaluate`, {
        message,
        evaluationId,
      });
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.posts.evaluations(variables.postId),
      });
    },
  });
}

export function usePostEvaluations(postId: string) {
  return useQuery({
    queryKey: queryKeys.posts.evaluations(postId),
    queryFn: async () => {
      const response = await apiClient.get<{ data: PostEvaluation[] }>(
        `/posts/${postId}/evaluations`,
      );
      return response.data.data;
    },
  });
}

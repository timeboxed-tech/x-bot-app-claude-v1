import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

type Bot = {
  id: string;
  userId: string;
  xAccountHandle: string;
  prompt: string;
  postMode: string;
  postsPerDay: number;
  minIntervalHours: number;
  preferredHoursStart: number;
  preferredHoursEnd: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type BotListResponse = {
  data: Bot[];
  meta: { page: number; pageSize: number; total: number };
};

type BotResponse = {
  data: Bot;
};

type CreateBotInput = {
  prompt: string;
  postMode: string;
  postsPerDay: number;
  minIntervalHours: number;
  preferredHoursStart: number;
  preferredHoursEnd: number;
};

type UpdateBotInput = {
  prompt?: string;
  postMode?: string;
  postsPerDay?: number;
  minIntervalHours?: number;
  preferredHoursStart?: number;
  preferredHoursEnd?: number;
  active?: boolean;
};

export function useBot() {
  const query = useQuery({
    queryKey: queryKeys.bots.list,
    queryFn: async () => {
      const response = await apiClient.get<BotListResponse>('/bots');
      return response.data;
    },
  });

  const bots = query.data?.data ?? [];
  const bot = bots.length > 0 ? bots[0] : null;

  return {
    bot,
    bots,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCreateBot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBotInput) => {
      const response = await apiClient.post<BotResponse>('/bots', input);
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bots.list });
    },
  });
}

export function useUpdateBot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateBotInput & { id: string }) => {
      const response = await apiClient.patch<BotResponse>(`/bots/${id}`, input);
      return response.data.data;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.bots.list });
      const previous = queryClient.getQueryData<BotListResponse>(queryKeys.bots.list);
      if (previous) {
        queryClient.setQueryData<BotListResponse>(queryKeys.bots.list, {
          ...previous,
          data: previous.data.map((b) =>
            b.id === variables.id ? { ...b, ...variables, updatedAt: new Date().toISOString() } : b,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.bots.list, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bots.list });
    },
  });
}

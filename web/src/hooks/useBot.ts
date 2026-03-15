import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

type BotOwner = {
  id: string;
  email: string;
  name: string;
};

export type Bot = {
  id: string;
  userId: string;
  platform: string;
  xAccountHandle: string;
  prompt: string;
  postMode: string;
  postsPerDay: number;
  minIntervalHours: number;
  preferredHoursStart: number;
  preferredHoursEnd: number;
  knowledgeSource: string;
  judgeKnowledgeSource: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  user?: BotOwner;
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
  knowledgeSource?: string;
  judgeKnowledgeSource?: string;
};

type UpdateBotInput = {
  prompt?: string;
  postMode?: string;
  postsPerDay?: number;
  minIntervalHours?: number;
  preferredHoursStart?: number;
  preferredHoursEnd?: number;
  knowledgeSource?: string;
  judgeKnowledgeSource?: string;
  active?: boolean;
};

export type BotShareUser = {
  id: string;
  email: string;
  name: string;
};

export type BotShare = {
  id: string;
  botId: string;
  userId: string;
  createdAt: string;
  user: BotShareUser;
};

type BotShareListResponse = {
  data: BotShare[];
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

export function useGenerateDrafts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ botId, count = 3 }: { botId: string; count?: number }) => {
      const response = await apiClient.post<{ data: Array<{ id: string; content: string }> }>(
        `/bots/${botId}/generate-drafts`,
        { count },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}

export function useBotShares(botId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.bots.shares(botId ?? ''),
    queryFn: async () => {
      const response = await apiClient.get<BotShareListResponse>(`/bots/${botId}/shares`);
      return response.data.data;
    },
    enabled: !!botId,
  });
}

export function useShareBot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ botId, email }: { botId: string; email: string }) => {
      const response = await apiClient.post<{ data: BotShare }>(`/bots/${botId}/shares`, {
        email,
      });
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bots.shares(variables.botId),
      });
    },
  });
}

export function useUnshareBot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ botId, userId }: { botId: string; userId: string }) => {
      await apiClient.delete(`/bots/${botId}/shares/${userId}`);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bots.shares(variables.botId),
      });
    },
  });
}

export type BotTip = {
  id: string;
  botId: string;
  content: string;
  createdAt: string;
};

type BotTipListResponse = {
  data: BotTip[];
};

export function useBotTips(botId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.bots.tips(botId ?? ''),
    queryFn: async () => {
      const response = await apiClient.get<BotTipListResponse>(`/bots/${botId}/tips`);
      return response.data.data;
    },
    enabled: !!botId,
  });
}

export function useUpdateTip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      botId,
      tipId,
      content,
    }: {
      botId: string;
      tipId: string;
      content: string;
    }) => {
      const response = await apiClient.patch<{ data: BotTip }>(`/bots/${botId}/tips/${tipId}`, {
        content,
      });
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bots.tips(variables.botId),
      });
    },
  });
}

export function useDeleteTip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ botId, tipId }: { botId: string; tipId: string }) => {
      await apiClient.delete(`/bots/${botId}/tips/${tipId}`);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bots.tips(variables.botId),
      });
    },
  });
}

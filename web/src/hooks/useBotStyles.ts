import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

export type BotStyle = {
  id: string;
  botId: string;
  title: string;
  content: string;
  active: boolean;
  createdAt: string;
};

type BotStyleListResponse = {
  data: BotStyle[];
};

export function useBotStyles(botId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.bots.styles(botId ?? ''),
    queryFn: async () => {
      const response = await apiClient.get<BotStyleListResponse>(`/bots/${botId}/styles`);
      return response.data.data;
    },
    enabled: !!botId,
  });
}

export function useCreateBotStyle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      botId,
      content,
      title,
    }: {
      botId: string;
      content: string;
      title?: string;
    }) => {
      const response = await apiClient.post<{ data: BotStyle }>(`/bots/${botId}/styles`, {
        content,
        title,
      });
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bots.styles(variables.botId),
      });
    },
  });
}

export function useUpdateBotStyle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      botId,
      styleId,
      content,
      title,
    }: {
      botId: string;
      styleId: string;
      content: string;
      title?: string;
    }) => {
      const response = await apiClient.patch<{ data: BotStyle }>(
        `/bots/${botId}/styles/${styleId}`,
        { content, title },
      );
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bots.styles(variables.botId),
      });
    },
  });
}

export function useDeleteBotStyle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ botId, styleId }: { botId: string; styleId: string }) => {
      await apiClient.delete(`/bots/${botId}/styles/${styleId}`);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bots.styles(variables.botId),
      });
    },
  });
}

export function useToggleBotStyle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      botId,
      styleId,
      active,
    }: {
      botId: string;
      styleId: string;
      active: boolean;
    }) => {
      const response = await apiClient.patch<{ data: BotStyle }>(
        `/bots/${botId}/styles/${styleId}/toggle`,
        { active },
      );
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bots.styles(variables.botId),
      });
    },
  });
}

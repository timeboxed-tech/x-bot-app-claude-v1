import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

export type BotBehaviour = {
  id: string;
  botId: string;
  title: string;
  content: string;
  knowledgeSource: string;
  weight: number;
  active: boolean;
  createdAt: string;
};

type BotBehaviourListResponse = {
  data: BotBehaviour[];
};

export function useBotBehaviours(botId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.bots.behaviours(botId ?? ''),
    queryFn: async () => {
      const response = await apiClient.get<BotBehaviourListResponse>(`/bots/${botId}/behaviours`);
      return response.data.data;
    },
    enabled: !!botId,
  });
}

export function useCreateBotBehaviour() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      botId,
      content,
      title,
      knowledgeSource,
      weight,
    }: {
      botId: string;
      content: string;
      title?: string;
      knowledgeSource?: string;
      weight?: number;
    }) => {
      const response = await apiClient.post<{ data: BotBehaviour }>(`/bots/${botId}/behaviours`, {
        content,
        title,
        knowledgeSource,
        weight,
      });
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bots.behaviours(variables.botId),
      });
    },
  });
}

export function useUpdateBotBehaviour() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      botId,
      behaviourId,
      content,
      title,
      knowledgeSource,
      weight,
    }: {
      botId: string;
      behaviourId: string;
      content: string;
      title?: string;
      knowledgeSource?: string;
      weight?: number;
    }) => {
      const response = await apiClient.patch<{ data: BotBehaviour }>(
        `/bots/${botId}/behaviours/${behaviourId}`,
        { content, title, knowledgeSource, weight },
      );
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bots.behaviours(variables.botId),
      });
    },
  });
}

export function useDeleteBotBehaviour() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ botId, behaviourId }: { botId: string; behaviourId: string }) => {
      await apiClient.delete(`/bots/${botId}/behaviours/${behaviourId}`);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bots.behaviours(variables.botId),
      });
    },
  });
}

export function useToggleBotBehaviour() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      botId,
      behaviourId,
      active,
    }: {
      botId: string;
      behaviourId: string;
      active: boolean;
    }) => {
      const response = await apiClient.patch<{ data: BotBehaviour }>(
        `/bots/${botId}/behaviours/${behaviourId}/toggle`,
        { active },
      );
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bots.behaviours(variables.botId),
      });
    },
  });
}

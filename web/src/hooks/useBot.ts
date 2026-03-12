import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

interface BotData {
  id: string;
  xAccountHandle: string;
  prompt: string;
  postMode: string;
  postsPerDay: number;
  minIntervalHours: number;
  preferredHoursStart: number;
  preferredHoursEnd: number;
  active: boolean;
  createdAt: string;
}

interface CreateBotPayload {
  prompt: string;
  postMode: 'auto' | 'manual';
  postsPerDay: number;
  minIntervalHours: number;
  preferredHoursStart: number;
  preferredHoursEnd: number;
}

interface UpdateBotPayload {
  prompt?: string;
  postMode?: 'auto' | 'manual';
  postsPerDay?: number;
  minIntervalHours?: number;
  preferredHoursStart?: number;
  preferredHoursEnd?: number;
  active?: boolean;
}

export function useBot() {
  const queryClient = useQueryClient();

  const {
    data: bot,
    isLoading,
    isError,
  } = useQuery<BotData | null>({
    queryKey: queryKeys.bots.mine,
    queryFn: async () => {
      const res = await apiClient.get('/bots/me');
      return res.data.data;
    },
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateBotPayload) => {
      const res = await apiClient.post('/bots', payload);
      return res.data.data as BotData;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.bots.mine, data);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ botId, ...payload }: UpdateBotPayload & { botId: string }) => {
      const res = await apiClient.patch(`/bots/${botId}`, payload);
      return res.data.data as BotData;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.bots.mine, data);
    },
  });

  return {
    bot: bot ?? null,
    isLoading,
    isError,
    createBot: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateBot: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

export type BotStats = {
  totalPosts: number;
  postsToday: number;
  averageRating: number | null;
  postsByStatus: {
    draft: number;
    scheduled: number;
    published: number;
    discarded: number;
  };
};

type StatsResponse = {
  data: BotStats;
};

export function useStats(botId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.stats.forBot(botId ?? ''),
    queryFn: async () => {
      const response = await apiClient.get<StatsResponse>(`/bots/${botId}/stats`);
      return response.data.data;
    },
    enabled: !!botId,
  });
}

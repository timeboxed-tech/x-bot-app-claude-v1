import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

export type JobQueueStats = {
  jobCounts: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  lastCompletedByType: Record<string, string | null>;
  nextPendingByType: Record<string, string | null>;
  recentJobs: Array<{
    id: string;
    type: string;
    botId: string | null;
    status: string;
    scheduledAt: string;
    startedAt?: string | null;
    completedAt?: string | null;
    error: string | null;
    result: string | null;
    createdAt: string;
  }>;
  recentErrors: Array<{
    id: string;
    type: string;
    botId: string | null;
    status: string;
    scheduledAt: string;
    completedAt?: string | null;
    error: string | null;
    result: string | null;
    createdAt: string;
  }>;
  activityLog: Array<{
    timestamp: string;
    worker: string;
    message: string;
    level: 'info' | 'warn' | 'error';
  }>;
};

type JobQueueStatsResponse = {
  data: JobQueueStats;
};

export function useJobQueue() {
  return useQuery({
    queryKey: queryKeys.jobs.stats(),
    queryFn: async () => {
      const response = await apiClient.get<JobQueueStatsResponse>('/jobs/stats');
      return response.data.data;
    },
    refetchInterval: 60000,
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      await apiClient.post(`/jobs/${jobId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', 'stats'] });
    },
  });
}

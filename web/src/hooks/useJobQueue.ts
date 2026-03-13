import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

export type JobQueueStats = {
  jobCounts: { pending: number; locked: number; completed: number; failed: number };
  postCounts: { draft: number; scheduled: number; published: number; discarded: number };
  recentJobs: Array<{
    id: string;
    botId: string;
    botHandle: string;
    status: string;
    scheduledAt: string;
    startedAt: string | null;
    completedAt: string | null;
    error: string | null;
    createdAt: string;
  }>;
  upcomingJobs: Array<{
    id: string;
    botId: string;
    botHandle: string;
    status: string;
    scheduledAt: string;
    createdAt: string;
  }>;
  recentErrors: Array<{
    id: string;
    botId: string;
    botHandle: string;
    status: string;
    scheduledAt: string;
    completedAt: string | null;
    error: string | null;
    createdAt: string;
  }>;
  lastCompletedAt: string | null;
  nextScheduledAt: string | null;
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
    queryKey: queryKeys.jobs.stats,
    queryFn: async () => {
      const response = await apiClient.get<JobQueueStatsResponse>('/jobs/stats');
      return response.data.data;
    },
    refetchInterval: 30000,
  });
}

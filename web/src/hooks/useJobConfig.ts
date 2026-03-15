import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

export type JobConfig = {
  id: string;
  jobType: string;
  intervalMs: number;
  enabled: boolean;
  updatedAt: string;
  createdAt: string;
};

type JobConfigListResponse = {
  data: JobConfig[];
};

export function useJobConfigs() {
  return useQuery({
    queryKey: queryKeys.jobConfigs.list,
    queryFn: async () => {
      const response = await apiClient.get<JobConfigListResponse>('/job-configs');
      return response.data.data;
    },
  });
}

export function useUpdateJobConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      intervalMs?: number;
      enabled?: boolean;
    }) => {
      const response = await apiClient.patch<{ data: JobConfig }>(`/job-configs/${id}`, input);
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobConfigs.list });
    },
  });
}

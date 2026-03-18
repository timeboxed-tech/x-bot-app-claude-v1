import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

export type SystemConfig = {
  id: string;
  key: string;
  name: string;
  value: string;
  updatedAt: string;
  createdAt: string;
};

type SystemConfigListResponse = {
  data: SystemConfig[];
};

export function useSystemConfigs() {
  return useQuery({
    queryKey: queryKeys.systemConfigs.list,
    queryFn: async () => {
      const response = await apiClient.get<SystemConfigListResponse>('/system-configs');
      return response.data.data;
    },
  });
}

export function useUpdateSystemConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; value?: string }) => {
      const response = await apiClient.patch<{ data: SystemConfig }>(
        `/system-configs/${id}`,
        input,
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.systemConfigs.list });
    },
  });
}

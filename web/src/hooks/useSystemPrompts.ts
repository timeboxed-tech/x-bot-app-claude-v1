import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

export type SystemPrompt = {
  id: string;
  key: string;
  name: string;
  content: string;
  updatedAt: string;
  createdAt: string;
};

type SystemPromptListResponse = {
  data: SystemPrompt[];
};

export function useSystemPrompts() {
  return useQuery({
    queryKey: queryKeys.systemPrompts.list,
    queryFn: async () => {
      const response = await apiClient.get<SystemPromptListResponse>('/system-prompts');
      return response.data.data;
    },
  });
}

export function useUpdateSystemPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; content?: string }) => {
      const response = await apiClient.patch<{ data: SystemPrompt }>(
        `/system-prompts/${id}`,
        input,
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.systemPrompts.list });
    },
  });
}

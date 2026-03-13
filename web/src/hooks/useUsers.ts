import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

type User = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  archivedAt: string | null;
};

type UsersResponse = {
  data: User[];
  meta: { page: number; pageSize: number; total: number };
};

export function useUsers(
  page: number = 1,
  pageSize: number = 20,
  includeArchived: boolean = false,
) {
  return useQuery({
    queryKey: ['users', 'list', page, pageSize, includeArchived],
    queryFn: async () => {
      const response = await apiClient.get<UsersResponse>('/users', {
        params: { page, pageSize, ...(includeArchived ? { includeArchived: true } : {}) },
      });
      return response.data;
    },
  });
}

export function useUpdateUserPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      const response = await apiClient.patch(`/users/${id}/password`, { password });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
    },
  });
}

export function useArchiveUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.patch(`/users/${id}/archive`);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
    },
  });
}

export function useReinstateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.patch(`/users/${id}/reinstate`);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
    },
  });
}

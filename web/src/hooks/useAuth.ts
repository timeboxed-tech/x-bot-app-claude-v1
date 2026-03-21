import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

type User = {
  id: string;
  email: string;
  isAdmin: boolean;
};

type AuthResponse = {
  data: User;
};

export function useAuth() {
  const query = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const response = await apiClient.get<AuthResponse>('/auth/me');
      return response.data.data;
    },
    retry: false,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: !!query.data,
    error: query.error,
  };
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const response = await apiClient.post('/auth/login', input);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { email: string; password: string; name: string; code: string }) => {
      const response = await apiClient.post('/auth/register', input);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout');
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading,
    isError,
  } = useQuery<AuthUser>({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const res = await apiClient.get('/auth/me');
      return res.data.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout');
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.auth.me, null);
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user && !isError,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}

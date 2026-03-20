import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export type ApiLogSummary = {
  id: string;
  provider: string;
  method: string;
  url: string;
  responseStatus: number | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
};

export type ApiLogDetail = ApiLogSummary & {
  requestHeaders: string | null;
  requestBody: string | null;
  responseHeaders: string | null;
  responseBody: string | null;
};

type ApiLogListResponse = {
  data: ApiLogSummary[];
  meta: { page: number; pageSize: number; total: number };
};

export function useApiLogs(provider?: string, page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ['api-logs', provider, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (provider) params.set('provider', provider);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      const response = await apiClient.get<ApiLogListResponse>(`/api-logs?${params}`);
      return response.data;
    },
    refetchInterval: 30000,
  });
}

export function useApiLogDetail(id: string | null) {
  return useQuery({
    queryKey: ['api-logs', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.get<{ data: ApiLogDetail }>(`/api-logs/${id}`);
      return response.data.data;
    },
    enabled: !!id,
  });
}

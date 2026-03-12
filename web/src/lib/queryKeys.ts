export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  bots: {
    list: ['bots', 'list'] as const,
    detail: (id: string) => ['bots', 'detail', id] as const,
  },
  posts: {
    list: (status?: string, page?: number) =>
      ['posts', 'list', status ?? 'all', page ?? 1] as const,
    all: ['posts'] as const,
  },
  stats: {
    forBot: (botId: string) => ['stats', 'bot', botId] as const,
  },
} as const;

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  bots: {
    list: ['bots', 'list'] as const,
    detail: (id: string) => ['bots', 'detail', id] as const,
    shares: (botId: string) => ['bots', 'shares', botId] as const,
  },
  posts: {
    list: (status?: string, page?: number, showAll?: boolean) =>
      ['posts', 'list', status ?? 'all', page ?? 1, showAll ?? false] as const,
    all: ['posts'] as const,
  },
  stats: {
    forBot: (botId: string) => ['stats', 'bot', botId] as const,
  },
  jobs: {
    stats: (showAll?: boolean) => ['jobs', 'stats', showAll ?? false] as const,
  },
} as const;

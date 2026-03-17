export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  bots: {
    list: ['bots', 'list'] as const,
    detail: (id: string) => ['bots', 'detail', id] as const,
    shares: (botId: string) => ['bots', 'shares', botId] as const,
    tips: (botId: string) => ['bots', 'tips', botId] as const,
    behaviours: (botId: string) => ['bots', 'behaviours', botId] as const,
    judges: (botId: string) => ['bots', 'judges', botId] as const,
  },
  posts: {
    list: (status?: string, page?: number, showAll?: boolean) =>
      ['posts', 'list', status ?? 'all', page ?? 1, showAll ?? false] as const,
    all: ['posts'] as const,
    counts: (showAll?: boolean) => ['posts', 'counts', showAll ?? false] as const,
    reviews: (postId: string) => ['posts', 'reviews', postId] as const,
    evaluations: (postId: string) => ['posts', 'evaluations', postId] as const,
  },
  stats: {
    forBot: (botId: string) => ['stats', 'bot', botId] as const,
  },
  jobs: {
    stats: () => ['jobs', 'stats'] as const,
  },
  judges: {
    list: ['judges', 'list'] as const,
  },
  systemPrompts: {
    list: ['systemPrompts', 'list'] as const,
  },
  jobConfigs: {
    list: ['jobConfigs', 'list'] as const,
  },
} as const;

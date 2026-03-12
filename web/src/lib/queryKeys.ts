export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  bots: {
    mine: ['bots', 'mine'] as const,
  },
  posts: {
    list: (botId: string) => ['posts', 'list', botId] as const,
  },
} as const;

import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://',
    directUrl: process.env.DIRECT_DATABASE_URL,
  },
  migrate: {
    async adapter() {
      const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
      if (!url) throw new Error('DATABASE_URL is required');
      const { PrismaPg } = await import('@prisma/adapter-pg');
      return new PrismaPg({ connectionString: url });
    },
  },
});

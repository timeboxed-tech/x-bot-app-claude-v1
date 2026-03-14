import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  migrate: {
    async adapter() {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error('DATABASE_URL is required');
      const { PrismaPg } = await import('@prisma/adapter-pg');
      return new PrismaPg({ connectionString: url });
    },
  },
});

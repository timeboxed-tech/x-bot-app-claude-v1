# x-bot-app-claude-v1

## Database

We use **Neon Postgres** with connection pooling enabled.

### Environment Variables

| Variable       | Purpose                                                              |
| -------------- | -------------------------------------------------------------------- |
| `DATABASE_URL` | Neon pooled connection string — used for both runtime and migrations |

In production, Neon provides a pooled URL (via PgBouncer) and a direct URL. Currently `prisma.config.ts` uses `DATABASE_URL` for both the runtime datasource and the migration adapter. If you need a separate direct connection for migrations, add a `DIRECT_DATABASE_URL` env var and wire it into `prisma.config.ts`.

### Configuration

- In Prisma 7, connection URLs live in `prisma.config.ts`, not in `schema.prisma`.

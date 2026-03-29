# x-bot-app-claude-v1

## Database

We use **Neon Postgres** with connection pooling enabled.

### Environment Variables

Both environment variables are required:

| Variable              | Purpose                                                    |
| --------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`        | Pooled connection string, used at runtime by the app       |
| `DIRECT_DATABASE_URL` | Direct (non-pooled) connection string, used for migrations |

### Configuration

- `schema.prisma` defines `directUrl = env("DIRECT_DATABASE_URL")` so Prisma can bypass the pooler when running migrations.
- `prisma.config.ts` uses `DATABASE_URL` in the migration adapter (`PrismaPg`) for the pooled runtime connection.

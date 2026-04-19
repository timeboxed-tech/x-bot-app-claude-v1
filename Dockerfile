FROM node:24-slim AS base

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
COPY shared/package.json shared/
COPY shared/tsconfig.json shared/

RUN npm ci

# Copy source code
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY api/ api/
COPY web/ web/

# Generate Prisma client
RUN cd api && npx prisma generate

# Build all packages
RUN npm run build --workspace=shared
RUN npm run build --workspace=web
RUN npm run build --workspace=api

# --- Production stage ---
FROM node:24-slim AS production

RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY api/package.json api/
COPY shared/package.json shared/

RUN npm ci --omit=dev

# Copy Prisma schema and config for migrations
COPY api/prisma api/prisma/
COPY api/prisma.config.ts api/

# Copy built artifacts
COPY --from=base /app/shared/dist shared/dist/
COPY --from=base /app/shared/package.json shared/
COPY --from=base /app/api/dist api/dist/
COPY --from=base /app/api/src/generated api/src/generated/
COPY --from=base /app/web/dist api/dist/web/

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["sh", "-c", "cd api && npx prisma migrate deploy && node dist/index.js"]

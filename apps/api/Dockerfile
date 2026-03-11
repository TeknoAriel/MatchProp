# MatchProp API — Docker multi-stage
# Build desde raíz del repo: docker build -f apps/api/Dockerfile .

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm build:shared \
  && pnpm --filter api exec prisma generate \
  && pnpm --filter api build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Copiar todo el árbol built (api + shared + pnpm store) para resolver workspaces
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared ./packages/shared

WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]

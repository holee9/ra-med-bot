# syntax=docker/dockerfile:1
# Multi-stage build for Regula (Next.js 15 standalone).
# Targets arm64 (raspi5p) and amd64; buildx cross-compilation works out of the box.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── 1. Install dependencies ──────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── 2. Build ─────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# SKIP_ENV_VALIDATION prevents Zod from blocking the build when real env vars
# are not present. Runtime validation still fires on `node server.js`.
ENV SKIP_ENV_VALIDATION=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ── 3. Production runner ──────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy public assets and standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static   ./.next/static

USER nextjs

EXPOSE 4000
ENV PORT=4000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]

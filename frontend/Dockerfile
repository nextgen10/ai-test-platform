# syntax=docker/dockerfile:1
#
# UI image. Build from the frontend/ directory:
#     podman build -f frontend/Dockerfile -t ai-test-ui:dev frontend
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    BUILD_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3100 \
    HOSTNAME=0.0.0.0

# Standalone output ships its own minimal node_modules; static assets and public/
# must be copied alongside it.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

RUN useradd --create-home --uid 10001 nextjs \
    && chown -R nextjs:nextjs /app
USER nextjs

EXPOSE 3100

# API_TARGET is read at server start by next.config.ts rewrites(), so the
# orchestrator address is injected at deploy time, not baked into the image.
CMD ["node", "server.js"]

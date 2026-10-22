# syntax=docker/dockerfile:1
# Multi-stage build for RavenClaw.
# Runtime image is non-root and contains only the app + pinned Node 24 runtime.

FROM node:24.18.1-alpine AS base
WORKDIR /app

FROM base AS deps
# Install only runtime dependency (Node itself); no npm packages are used.
COPY package.json ./

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
ENV SESSION_TTL_SECONDS=28800
ENV RATE_LIMIT_WINDOW_MS=60000
ENV RATE_LIMIT_MAX=120
ENV COOKIE_SECURE=false

RUN addgroup -g 1001 -S app && adduser -u 1001 -S app -G app

COPY --chown=app:app package.json ./
COPY --chown=app:app server.js ./
COPY --chown=app:app lib ./lib
COPY --chown=app:app migrations ./migrations
COPY --chown=app:app public ./public

RUN mkdir -p /data && chown -R app:app /data
USER app

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('node:http').get('http://localhost:3000/healthz', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["node", "server.js"]

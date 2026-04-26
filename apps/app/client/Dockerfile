# Build context: monorepo root
# Dockerfile path: apps/app/client/Dockerfile

# ─── Builder ───────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /repo

COPY package*.json ./
COPY apps/app/shared/package*.json ./apps/app/shared/
COPY apps/app/client/package*.json ./apps/app/client/
COPY apps/app/server/package*.json ./apps/app/server/
COPY apps/marketing/package*.json ./apps/marketing/

RUN npm install --workspaces --include-workspace-root --no-audit --no-fund

COPY apps/app/shared ./apps/app/shared
COPY apps/app/client ./apps/app/client

# Build-time env vars baked into the bundle
ARG VITE_API_URL
ARG VITE_MARKETING_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MARKETING_URL=$VITE_MARKETING_URL

RUN npm --workspace @acumen/shared run build || true
RUN npm --workspace @acumen/client run build

# ─── Runner (Nginx serving static SPA) ─────────────────────
FROM nginx:1.27-alpine AS runner

COPY apps/app/client/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /repo/apps/app/client/dist /usr/share/nginx/html

ENV PORT=8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

# ─── Builder ───────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

# Workspace manifests
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY client/package*.json ./client/

RUN npm install --workspaces --include-workspace-root --no-audit --no-fund

# Source
COPY shared ./shared
COPY client ./client

# Build env vars baked in at build time
ARG VITE_API_URL
ARG VITE_MARKETING_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MARKETING_URL=$VITE_MARKETING_URL

RUN npm --workspace @acumen/client run build

# ─── Runner (Nginx) ────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# SPA fallback config — listens on $PORT (Cloud Run default 8080)
COPY client/nginx.conf /etc/nginx/templates/default.conf.template

COPY --from=builder /app/client/dist /usr/share/nginx/html

ENV PORT=8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

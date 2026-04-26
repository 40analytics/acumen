# ─── Builder ───────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

# Workspace manifests (better caching)
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm install --workspaces --include-workspace-root --no-audit --no-fund

# Source for shared + server (skip client — not needed in API container)
COPY shared ./shared
COPY server ./server

# Build
RUN npm --workspace @acumen/shared run build || true
RUN npm --workspace @acumen/server run build

# ─── Runner ────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Production deps only
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
RUN npm install --omit=dev --workspaces --include-workspace-root --no-audit --no-fund \
  --workspace @acumen/server --workspace @acumen/shared

# Built artifacts
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/

# Cloud Run injects PORT — default to 8080 locally
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/dist/index.js"]

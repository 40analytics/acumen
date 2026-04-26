# Build context: monorepo root
# Dockerfile path: apps/app/server/Dockerfile

# ─── Builder ───────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /repo

# Workspace manifests (cache layer)
COPY package*.json ./
COPY apps/app/shared/package*.json ./apps/app/shared/
COPY apps/app/server/package*.json ./apps/app/server/
COPY apps/app/client/package*.json ./apps/app/client/
COPY apps/marketing/package*.json ./apps/marketing/

RUN npm install --workspaces --include-workspace-root --no-audit --no-fund

# Source for shared + server only (client + marketing not needed)
COPY apps/app/shared ./apps/app/shared
COPY apps/app/server ./apps/app/server

RUN npm --workspace @acumen/shared run build || true
RUN npm --workspace @acumen/server run build

# ─── Runner ────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Hoisted node_modules + built dist + the shared package source
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/app/shared ./shared
COPY --from=builder /repo/apps/app/server/dist ./dist
COPY --from=builder /repo/apps/app/server/package.json ./

ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]

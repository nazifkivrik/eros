# ============================================
# Multi-Stage Dockerfile for Eros Platform
# ============================================

FROM node:20-slim AS base

# Debian (slim) için gerekli paketler. 
# 'apk' yerine 'apt-get' kullanılır.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    gosu \
    && rm -rf /var/lib/apt/lists/* && \
    corepack enable && \
    corepack prepare pnpm@9.15.0 --activate

# ============================================
# Dependencies Stage
# ============================================
FROM base AS deps
WORKDIR /app

# Workspace dosyalarını kopyala
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/database/package.json ./packages/database/
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/

# Bağımlılıkları yükle
RUN pnpm install --frozen-lockfile

# ============================================
# Builder Stage
# ============================================
FROM base AS builder
WORKDIR /app

# Tüm node_modules'u deps stage'den kopyala
COPY --from=deps /app /app

# Kaynak kodlarını üzerine kopyala (sadece src dosyaları)
# typescript-config
COPY packages/typescript-config ./packages/typescript-config

# shared-types
COPY packages/shared-types/src ./packages/shared-types/src
COPY packages/shared-types/tsconfig.json ./packages/shared-types/
COPY packages/shared-types/tsup.config.ts ./packages/shared-types/

# database
COPY packages/database/src ./packages/database/src
COPY packages/database/drizzle.config.ts ./packages/database/
COPY packages/database/tsconfig.json ./packages/database/
COPY packages/database/tsup.config.ts ./packages/database/

# web
COPY apps/web ./apps/web

# server
COPY apps/server/src ./apps/server/src
COPY apps/server/tsconfig.json ./apps/server/
COPY apps/server/tsup.config.ts ./apps/server/

# turbo.json for build configuration
COPY turbo.json ./

# Build işlemi - cache mount ile hızlandır
RUN --mount=type=cache,target=/root/.cache/turbo \
    --mount=type=cache,target=/app/.turbo \
    pnpm turbo build --filter=web --filter=server

# Build doğrulama
RUN test -d /app/apps/server/dist && \
    test -d /app/apps/web/.next && \
    test -d /app/packages/database/dist && \
    test -d /app/packages/shared-types/dist || \
    (echo "Build verification failed" && exit 1)

# ============================================
# Production Dependencies Stage
# ============================================
FROM base AS prod-deps
WORKDIR /app
ENV NODE_ENV=production

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/database/package.json ./packages/database/
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/

RUN pnpm install --frozen-lockfile --prod

# ============================================
# Production Runner Stage
# ============================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Eros kullanıcısını ve grubunu oluştur (Node kullanıcısını modifiye ederek)
RUN groupmod -n eros node && \
    usermod -l eros -d /home/eros -m node

# Gerekli klasörleri oluştur
RUN mkdir -p /data /app/media /home/eros/.cache && \
    mkdir -p /app/media/scenes /app/media/incomplete

# ============================================
# Copy Backend & Frontend Artifacts
# ============================================
# Backend
COPY --from=builder --chown=eros:eros /app/apps/server/dist ./apps/server/dist
COPY --from=builder --chown=eros:eros /app/apps/server/package.json ./apps/server/

# Frontend (Next.js)
RUN mkdir -p apps/web/.next && chown eros:eros apps/web/.next
COPY --from=builder --chown=eros:eros /app/apps/web/.next/standalone ./
COPY --from=builder --chown=eros:eros /app/apps/web/.next/static ./apps/web/.next/static

# Shared Packages
COPY --from=builder --chown=eros:eros /app/packages/database/dist ./packages/database/dist
COPY --from=builder --chown=eros:eros /app/packages/database/package.json ./packages/database/
COPY --from=builder --chown=eros:eros /app/packages/database/src/migrations ./packages/database/dist/migrations
COPY --from=builder --chown=eros:eros /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder --chown=eros:eros /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder --chown=eros:eros /app/packages/typescript-config ./packages/typescript-config

# Node Modules
COPY --from=prod-deps --chown=eros:eros /app/node_modules ./node_modules
COPY --from=prod-deps --chown=eros:eros /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=prod-deps --chown=eros:eros /app/packages/database/node_modules ./packages/database/node_modules

# Environment variables
ENV PORT=3001
ENV HOST="0.0.0.0"
ENV DATABASE_PATH=/data/app.db
ENV NEXT_PUBLIC_API_URL=/api
ENV SCENES_PATH=/app/media/scenes
ENV INCOMPLETE_PATH=/app/media/incomplete

# ============================================
# Entrypoint Script (PUID/PGID Logic)
# ============================================
# Bu script root olarak çalışır, izinleri ayarlar ve sonra eros kullanıcısına geçer
COPY <<'EOF' /usr/local/bin/docker-entrypoint.sh
#!/bin/bash
set -e

# PUID ve PGID değişkenlerini al (varsayılan 1000)
PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Starting container with PUID: $PUID and PGID: $PGID"

# Eros kullanıcısının ID'sini güncelle
groupmod -o -g "$PGID" eros
usermod -o -u "$PUID" eros

# Klasör izinlerini güncelle (Host'tan gelen mountlar dahil)
echo "Fixing permissions for /data and /app/media..."

# Create media subdirectories if they don't exist
mkdir -p /app/media/scenes /app/media/incomplete

chown -R eros:eros /data
chown -R eros:eros /app/media
chown -R eros:eros /app/apps/web/.next
chown -R eros:eros /home/eros

# Root yetkisinden çık ve 'eros' kullanıcısı ile komutu çalıştır
# gosu, Debian/Ubuntu sistemlerde su-exec yerine kullanılır
exec gosu eros "$@"
EOF

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# ============================================
# Startup Script
# ============================================
COPY --chown=eros:eros <<'EOF' /app/start.sh
#!/bin/sh
set -e

echo "Starting Eros Platform..."

# Start backend server
echo "Starting backend server on port 3001..."
node apps/server/dist/server.js &
BACKEND_PID=$!

# Wait for backend
sleep 2

# Start frontend server
echo "Starting frontend server on port 3000..."
PORT=3000 BACKEND_URL=http://localhost:3001 node apps/web/server.js &
FRONTEND_PID=$!

# Wait for both
wait $BACKEND_PID $FRONTEND_PID
EOF

RUN chmod +x /app/start.sh

# Expose ports
EXPOSE 3000 3001

# ÖNEMLİ: USER eros komutunu kaldırdık. 
# Container ROOT olarak başlayacak, Entrypoint izinleri düzeltip EROS kullanıcısına geçecek.

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["/app/start.sh"]

# ============================================
# Health Check
# ============================================
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "Promise.all([fetch('http://localhost:3000'),fetch('http://localhost:3001/health')]).then(()=>process.exit(0)).catch(()=>process.exit(1))"
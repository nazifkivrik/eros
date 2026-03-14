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
    curl \
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
COPY --from=builder --chown=eros:eros /app/packages/database/src/schema.ts ./packages/database/dist/schema.ts
COPY --from=builder --chown=eros:eros /app/packages/database/drizzle.config.ts ./packages/database/drizzle.config.ts
# Copy migrations to both src/ and dist/ for compatibility
COPY --from=builder --chown=eros:eros /app/packages/database/src/migrations ./packages/database/src/migrations
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
# Remove -e flag to continue on errors, we'll handle them manually

# PUID ve PGID değişkenlerini al (varsayılan 1000)
PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Starting container with PUID: $PUID and PGID: $PGID"

# Eros kullanıcısının ID'sini güncelle
groupmod -o -g "$PGID" eros || true
usermod -o -u "$PUID" eros || true

# Klasör izinlerini güncelle (Host'tan gelen mountlar dahil)
echo "Fixing permissions for /data and /app/media..."

# Create default media directories
mkdir -p /app/media/scenes /app/media/incomplete || true

# Dynamically discover and setup all mounted disks under /app/
echo "Setting up additional disk directories..."
echo "Scanning for mounted disks under /app/..."

# Internal container directories to skip (not volume mounts)
SKIP_DIRS="media apps node_modules packages"

# Find all directories directly under /app/
for dir in /app/*/; do
  # Remove trailing slash
  dir="${dir%/}"

  # Get directory name
  dirname_val=$(basename "$dir")

  # Skip internal container directories and hidden directories
  skip_dir=0
  for skip in $SKIP_DIRS; do
    if [ "$dirname_val" = "$skip" ]; then
      skip_dir=1
      break
    fi
  done

  if [ $skip_dir -eq 1 ] || [[ "$dirname_val" == .* ]]; then
    continue
  fi

  if [ -d "$dir" ]; then
    echo "Found disk: $dir"
    # Create the media/scenes structure
    mkdir -p "$dir/media/scenes" "$dir/media/incomplete" || true
    # Fix permissions for the created directories only
    # Use find to only change permissions for our created directories
    find "$dir/media" -type d -exec chown eros:eros {} + 2>/dev/null || true
    find "$dir/media" -type f -exec chown eros:eros {} + 2>/dev/null || true
    echo "  Created: $dir/media/scenes"
    echo "  Created: $dir/media/incomplete"
  fi
done

# Also scan /mnt/ for any additional mounts
# NOTE: For mounted disks, we'll create directories as the eros user at runtime
# This avoids permission issues with NFS/CIFS mounts that have restrictive root access
if [ -d /mnt ]; then
  echo "Found /mnt directory - will create media subdirectories at runtime"
  for dir in /mnt/*/; do
    dir="${dir%/}"
    if [ -d "$dir" ]; then
      echo "  Detected mount: $dir (will create $dir/media/scenes at runtime if needed)"
    fi
  done
fi

# Fix permissions for all standard directories
chown -R eros:eros /data 2>/dev/null || true
chown -R eros:eros /app/media 2>/dev/null || true
chown -R eros:eros /app/apps/web/.next 2>/dev/null || true
chown -R eros:eros /home/eros 2>/dev/null || true

# Auto-fix permissions for media paths from environment
# This ensures directories from .env (MEDIA_PATH_1, MEDIA_PATH_2) are properly set up
echo "Setting up media directories from .env configuration..."

# Function to fix a media directory
setup_media_directory() {
  local base_path="$1"
  local path_name="$2"

  if [ -z "$base_path" ] || [ ! -d "$base_path" ]; then
    echo "  ⊘ Skipping $path_name: $base_path (not found or not set)"
    return 1
  fi

  echo "  → Setting up $path_name: $base_path"

  # Create media subdirectories
  if mkdir -p "$base_path/scenes" "$base_path/incomplete" 2>/dev/null; then
    # Try to fix ownership
    if chown -R ${PUID}:${PGID} "$base_path" 2>/dev/null; then
      echo "  ✓ Fixed permissions (chown) for: $base_path"
      return 0
    elif chmod -R 775 "$base_path" 2>/dev/null; then
      echo "  ✓ Fixed permissions (chmod 775) for: $base_path"
      return 0
    else
      echo "  ! Created directories but could not fix permissions for: $base_path"
      echo "    Run on host: sudo chown -R ${PUID}:${PGID} $base_path"
      return 1
    fi
  else
    echo "  ✗ Could not create directories in: $base_path (permission denied)"
    echo "    Run on host: sudo chown -R ${PUID}:${PGID} $base_path"
    return 1
  fi
}

# Process MEDIA_PATH_1 if set
if [ -n "$MEDIA_PATH_1" ]; then
  setup_media_directory "$MEDIA_PATH_1" "MEDIA_PATH_1"
fi

# Process MEDIA_PATH_2 if set
if [ -n "$MEDIA_PATH_2" ]; then
  setup_media_directory "$MEDIA_PATH_2" "MEDIA_PATH_2"
fi

echo "Media directory setup complete!"
echo ""

echo "Directory setup complete!"
echo "Permissions fixed successfully"

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
echo "Starting Eros Platform..."

# Note: Media directories in mounted volumes will be created on-demand by the application
# This avoids permission issues with various mount points (NFS, CIFS, bind mounts, etc.)

# Run database schema sync/migration
echo "Syncing database schema..."
cd /app/packages/database

# Try migrate first (production-safe), fall back to push for existing databases
if npx drizzle-kit migrate 2>/dev/null; then
  echo "Database migrations completed successfully"
else
  echo "Migration failed (might be existing DB), trying schema sync..."
  npx drizzle-kit push || echo "Schema sync completed with warnings"
fi

cd /app

# Start backend server
echo "Starting backend server on port 3001..."
node apps/server/dist/server.js &
BACKEND_PID=$!

# Wait for backend with health check (max 30 seconds)
echo "Waiting for backend to be ready..."
MAX_WAIT=30
WAITED=0

while [ $WAITED -lt $MAX_WAIT ]; do
  if node -e "require('http').get('http://localhost:3001/health', (r) => { if (r.statusCode === 200) process.exit(0) }).on('error', () => process.exit(1))" 2>/dev/null; then
    echo "Backend is ready!"
    break
  fi
  sleep 1
  WAITED=$((WAITED + 1))
  echo "Waiting for backend... ($WAITED/$MAX_WAIT)"
done

if [ $WAITED -eq $MAX_WAIT ]; then
  echo "ERROR: Backend failed to start within $MAX_WAIT seconds"
  exit 1
fi

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
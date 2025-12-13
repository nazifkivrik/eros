# Eros

Adult content automation platform with performer/studio/scene subscription management, intelligent torrent search, and automated downloading.

## Features

- **Multi-Entity Subscription**: Subscribe to performers, studios, or individual scenes
- **Intelligent Search**: Integration with StashDB for metadata
- **Quality Profiles**: Customizable quality preferences with fallback options
- **Automated Downloads**: Background jobs for automatic torrent discovery and download
- **Metadata Management**: Automatic .nfo file generation and poster downloads
- **AI-Powered Matching**: Optional AI-based scene matching using vector similarity
- **Torrent Management**: Built-in torrent client integration with qBittorrent
- **Docker Ready**: Full Docker Compose setup with volume management

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Next.js 15 (App Router) + React 19 + Tailwind CSS
- **Backend**: Fastify + TypeScript + Zod
- **Database**: SQLite + Drizzle ORM
- **Torrent**: qBittorrent Web API
- **Meta Service**: StashDB GraphQL API (extensible)
- **Indexers**: Prowlarr API
- **AI**: Xenova/transformers (optional)

## Project Structure

```
.
├── apps/
│   ├── web/                 # Next.js frontend
│   └── server/              # Fastify backend
├── packages/
│   ├── database/            # Drizzle schema + migrations
│   ├── ui/                  # Shared UI components
│   ├── typescript-config/   # Shared tsconfig
│   └── shared-types/        # Shared types
├── docker/
│   └── docker-compose.yml
└── turbo.json
```

## Getting Started

### Development

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Setup environment variables**:
   ```bash
   # Copy example env files
   cp .env.example .env
   cp apps/server/.env.example apps/server/.env
   cp apps/web/.env.local.example apps/web/.env.local
   ```

3. **Generate database migrations**:
   ```bash
   cd packages/database
   pnpm db:generate
   ```

4. **Run development servers**:
   ```bash
   pnpm dev
   ```

   This will start:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

### Docker Deployment

1. **Setup environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Build and run**:
   ```bash
   docker-compose up -d
   ```

3. **Access services**:
   - Web UI: http://localhost:3000
   - API: http://localhost:3001
   - qBittorrent: http://localhost:8080
   - Prowlarr: http://localhost:9696

## Configuration

### Authentication

Default credentials:
- Password: `admin` (change in `.env` via `ADMIN_PASSWORD`)

### Download Paths

The application supports multiple download locations via Docker volumes:

```yaml
volumes:
  - /path/to/storage1:/downloads/additional1:rw
  - /path/to/storage2:/downloads/additional2:rw
```

### Quality Profiles

Create custom quality profiles in Settings with ordered preferences:
1. 2160p Bluray
2. 1080p Bluray
3. 1080p WebDL
4. 720p
5. Any

The system will always try to get the highest quality available based on your profile.

### Background Jobs

Configured via environment variables (cron format):
- **Subscription Search**: Every 6 hours (searches for new scenes)
- **Metadata Refresh**: Daily at 2 AM (updates metadata)
- **Torrent Monitor**: Every 5 minutes (manages torrents)
- **Cleanup**: Weekly on Sunday at 3 AM
- **Metadata Discovery**: Daily at 4 AM (finds metadata for inferred scenes)

## API Documentation

Backend API is available at `http://localhost:3001/api`

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/status` - Check authentication status

### Health Check
- `GET /health` - Server health status

More endpoints will be documented as they are implemented.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run development mode (all apps)
pnpm dev

# Build all apps
pnpm build

# Lint
pnpm lint

# Format code
pnpm format

# Clean build artifacts
pnpm clean
```

### Database Commands

```bash
cd packages/database

# Generate migrations from schema
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Push schema directly (dev only)
pnpm db:push

# Open Drizzle Studio
pnpm db:studio
```

## License

Private project - All rights reserved

## Roadmap

### Phase 1: Foundation ✅
- [x] Monorepo setup
- [x] Next.js frontend initialization
- [x] Fastify backend initialization
- [x] Database schema
- [x] Authentication
- [x] Docker configuration

### Phase 2: Core Services ✅
- [x] StashDB GraphQL client
- [x] Prowlarr API integration
- [x] qBittorrent API integration
- [x] CRUD operations (performers)
- [x] Quality profiles management
- [x] Database migrations generated

### Phase 3: Search & Subscribe
- [ ] Search page with meta service
- [ ] Result cards and detail dialogs
- [ ] Subscribe dialog
- [ ] Subscription logic

### Phase 4: Download System
- [ ] Torrent search with regex parsing
- [ ] Quality selection
- [ ] Download queue
- [ ] File management (folders, .nfo, posters)

### Phase 5: Background Jobs
- [ ] Job scheduler
- [ ] Subscription search job
- [ ] Metadata refresh job
- [ ] Torrent monitor job
- [ ] Cleanup job

### Phase 6: AI Matching
- [ ] Xenova/transformers integration
- [ ] Vector embeddings
- [ ] Similarity matching

### Phase 7: Torrent Management
- [ ] Speed profiles
- [ ] Stalled detection
- [ ] Auto-pause/reorder

### Phase 8: Polish
- [ ] Detail pages
- [ ] Dashboard
- [ ] Settings page
- [ ] Error handling
- [ ] Notifications

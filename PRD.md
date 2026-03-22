# Eros - Product Requirements Document

## Document Version: 1.1
**Last Updated:** 2025-03-17
**Project Type:** Adult Content Automation Platform

---

## 1. Executive Summary

### 1.1 Project Overview

Eros is an **adult content automation platform** that enables users to automatically discover, download, organize, and manage adult video content. The system provides subscription-based monitoring of performers, studios, and scenes, with intelligent torrent search, quality-based filtering, and automated downloading capabilities.

### 1.1.1 Core Value Propositions

1. **Automated Content Discovery**: Subscribe to performers or studios and automatically discover new content
2. **Intelligent Download Management**: Quality profile-based filtering with automatic torrent selection
3. **Unified Content Library**: Organize downloaded content with rich metadata from multiple sources
4. **Self-Hosted Solution**: Complete control over data and content with Docker-based deployment
5. **Multi-Source Integration**: Support for multiple indexers, torrent clients, and metadata providers

### 1.1.2 Target Users

- **Home Media Enthusiasts**: Users maintaining personal adult content libraries
- **Automation Seekers**: Users wanting automated content discovery and downloading
- **Quality-Conscious Collectors**: Users with specific quality requirements and preferences
- **Self-Hosting Advocates**: Users preferring privacy and control over cloud-based solutions

---

## 2. System Architecture

### 2.1 Technology Stack

#### 2.1.1 Monorepo Structure
- **Build System**: Turborepo with pnpm workspaces
- **Package Manager**: pnpm v9.15.0+
- **Node Version**: v20+
- **Language**: TypeScript (strict mode)

#### 2.1.2 Frontend Stack
- **Framework**: Next.js 15 with React 19
- **Styling**: Tailwind CSS with Radix UI components
- **State Management**: TanStack Query (server state), Zustand (client state)
- **Routing**: App Router with Server Components
- **Validation**: Zod schemas

#### 2.1.3 Backend Stack
- **Framework**: Fastify 5 with TypeScript
- **Database**: SQLite with Drizzle ORM
- **Authentication**: Session-based with Argon2 password hashing
- **Validation**: fastify-type-provider-zod
- **Logging**: Pino structured logging
- **Dependency Injection**: Awilix container
- **Job Scheduling**: node-cron

#### 2.1.4 Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose for service management
- **Reverse Proxy**: Optional Traefik integration

### 2.2 Architecture Patterns

#### 2.2.1 Backend: Clean Architecture

The backend follows strict Clean Architecture principles with four layers:

```
┌─────────────────────────────────────────────────────────┐
│  Routes Layer (HTTP)                                     │
│  - HTTP routing only                                     │
│  - OpenAPI schema definitions                            │
│  - Error code mapping                                    │
├─────────────────────────────────────────────────────────┤
│  Controllers Layer (Interface)                           │
│  - Request/response handling                             │
│  - Validation mapping                                    │
│  - Response formatting                                   │
├─────────────────────────────────────────────────────────┤
│  Services Layer (Application)                            │
│  - Business logic                                        │
│  - External API orchestration                            │
│  - Workflow coordination                                 │
├─────────────────────────────────────────────────────────┤
│  Repositories Layer (Infrastructure)                     │
│  - Data access (CRUD)                                    │
│  - Database queries                                      │
│  - External service adapters                             │
└─────────────────────────────────────────────────────────┘
```

**Key Principles**:
- No layer skipping (e.g., Routes → Repository)
- Framework-agnostic business logic
- Dependency inversion via interfaces
- Constructor injection for all dependencies

#### 2.2.2 Frontend: Feature-Based Architecture

```
src/
├── app/                 # Next.js App Router (pages)
├── features/            # Feature modules (self-contained)
│   ├── dashboard/
│   ├── subscriptions/
│   ├── search/
│   ├── downloads/
│   └── settings/
├── components/          # Shared UI components
├── hooks/              # Shared React hooks
└── lib/                # Utilities and clients
```

**Key Principles**:
- Features are self-contained with components, hooks, types
- Server Components by default
- URL as source of truth for filters/pagination
- Optimistic UI updates with rollback

### 2.3 Deployment Architecture

#### 2.3.1 Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| eros-app | 3000, 3001 | Main application (web + API) |
| qBittorrent | 8080 | Torrent client |
| Prowlarr | 9696 | Indexer management |
| Jellyfin | 8096 | Media server (optional) |
| FlareSolverr | 8191 | Cloudflare bypass (optional) |

#### 2.3.2 Volume Structure

| Volume | Purpose | Shared With |
|--------|---------|-------------|
| Media Path | Downloaded content storage | qBittorrent, Jellyfin |
| Database Path | SQLite database files | eros-app |
| Config Path | Application configuration | eros-app |

---

## 3. Functional Requirements

### 3.1 Subscription Management

#### 3.1.1 Subscription Types

The system supports three types of subscriptions:

1. **Performer Subscriptions**
   - Monitor all scenes featuring a specific performer
   - Auto-discover new scenes from external databases
   - Support for aliases and alternative names

2. **Studio Subscriptions**
   - Monitor all releases from a specific studio
   - Support for studio networks and parent studios
   - Scene filtering by metadata completeness

3. **Scene Subscriptions**
   - Subscribe to individual scenes
   - Manual quality selection
   - File organization preferences

#### 3.1.2 Subscription Configuration

Each subscription supports the following settings:

- **Quality Profile**: Define download quality preferences
- **Auto-Download**: Enable/disable automatic downloading
- **Metadata Preferences**: Include items missing metadata
- **Alias Handling**: Include content with alternative names
- **Priority**: Queue ordering for downloads

#### 3.1.3 Subscription Workflows

**Create Subscription**:
1. Search for performer/studio/scene
2. View detailed information
3. Select quality profile
4. Configure preferences
5. Subscribe

**Manage Subscription**:
1. View subscription details
2. See associated scenes
3. Monitor download status
4. Adjust settings
5. Pause/delete subscription

**Scene-Level Management**:
1. For performer/studio subscriptions
2. View all discovered scenes
3. Toggle individual scene downloads
4. Set per-scene quality preferences

### 3.2 Torrent Search and Discovery

#### 3.2.1 Search Capabilities

**Manual Search**:
- Search across all configured indexers
- Filter by quality, source, size, seeders
- Sort by relevance, date, seeders, size
- Preview torrent details before downloading

**Automatic Search**:
- Scheduled searches for subscriptions
- Quality profile application
- Duplicate prevention
- Automatic queueing of qualifying results

#### 3.2.2 Quality Profiles

Quality profiles define download preferences:

- **Source Rules**: Different settings for different sources
- **Quality Preferences**: Resolution (4K, 1080p, 720p, etc.)
- **Size Constraints**: Min/max file sizes
- **Seeder Thresholds**: Minimum seeder requirements
- **Priority Ordering**: Preferred qualities first

#### 3.2.3 Torrent Matching

The system uses multiple matching strategies:

1. **Title Matching**: Exact and fuzzy title comparison
2. **Hash Matching**: oshash, MD5, perceptual hash
3. **Metadata Matching**: Cross-reference with scene databases
4. **AI Matching** (Optional): Transformer-based similarity scoring

### 3.3 Download Management

#### 3.3.1 Download Queue

**Queue Operations**:
- Add scenes to download queue
- Manual torrent selection
- Automatic torrent selection (based on quality profile)
- Priority management
- Pause/resume downloads

**Queue States**:
- `pending`: Awaiting download
- `searching`: Searching for torrents
- `queued`: Added to torrent client
- `downloading`: Active download
- `completed`: Download finished
- `failed`: Error occurred
- `paused`: User paused

#### 3.3.2 Torrent Client Integration

**qBittorrent Features**:
- Add torrents (magnet links and torrent files)
- Monitor download progress
- Pause/resume/remove torrents
- Queue priority management
- Speed limiting
- Automatic retry for failed downloads

**Alternative Clients** (via provider registry):
- Support for multiple torrent clients
- Failover between clients
- Client-specific configuration

#### 3.3.3 Download Completion Handling

When a download completes:
1. Move file to organized location
2. Extract metadata
3. Match to scene in database
4. Record file information
5. Trigger post-processing (if configured)

### 3.4 Background Jobs

#### 3.4.1 Scheduled Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| Torrent Monitor | Every 5 minutes | Check download status, handle completions |
| Subscription Search | Configurable | Search for new content from subscriptions |
| Metadata Refresh | Configurable | Update scene metadata from external sources |
| Cleanup | Daily | Remove old logs, temporary files |

#### 3.4.2 Job Features

- **Progress Tracking**: Real-time progress updates
- **Error Handling**: Retry with exponential backoff
- **Logging**: Detailed execution logs
- **Manual Trigger**: Force job execution from UI

### 3.5 Quality Management

#### 3.5.1 Quality Detection

The system parses quality information from torrent names:

- **Resolution**: 4K, 1080p, 720p, 480p, etc.
- **Source**: WEB-DL, BluRay, DVD, etc.
- **Codec**: H.264, H.265, etc.
- **Audio**: AAC, AC3, etc.

#### 3.5.2 Quality Profiles

Users can define multiple quality profiles with:

- **Profile Items**: Ordered list of quality preferences
- **Source-Specific Rules**: Different settings per indexer/source
- **Size Limits**: Min/max file sizes per quality tier
- **Seeder Requirements**: Minimum seeders per quality tier

### 3.6 Content Organization

#### 3.6.1 File Organization

Downloaded content is organized using:

- **Configurable Directory Structure**: User-defined paths
- **Naming Patterns**: Customizable file naming
- **Metadata Embedding**: Optional metadata in file names
- **Duplicate Prevention**: Hash-based deduplication

#### 3.6.2 Scene Management

**Scene Information Stored**:
- Title and description
- Release date
- Performers (many-to-many)
- Studio/network
- Quality information
- File associations
- External IDs (TPDB, StashDB)
- Tags and categories

### 3.7 External Service Integration

#### 3.7.1 Metadata Providers

**TPDB (ThePornDB)**:
- Performer information
- Studio data
- Scene metadata
- External ID resolution
- Image posters

**StashDB**:
- Scene metadata enrichment
- Tag management
- Alternative titles
- Hash-based identification

**Multi-Provider Strategy**:
- Primary/secondary provider configuration
- Automatic failover
- Result merging and deduplication

#### 3.7.2 Indexer Integration

**Prowlarr**:
- Unified interface to multiple indexers
- Category filtering
- Magnet link handling
- Search result aggregation

**Direct Indexer Support** (future):
- Individual indexer configuration
- Custom indexer API integration

#### 3.7.3 Torrent Client Integration

**qBittorrent** (primary):
- Full API integration
- Real-time status updates
- Queue management
- Speed control

**Alternative Clients**:
- Deluge (planned)
- rTorrent (planned)
- Transmission (planned)

---

## 4. Data Model Overview

### 4.1 Core Entities

The system manages the following primary entities:

- **Performers**: Actors/actresses with metadata, external IDs, images
- **Studios**: Production companies with hierarchy support (parent studios, networks)
- **Scenes**: Individual video content with performers, studio, quality info, file associations
- **Subscriptions**: Entity-based monitoring with quality profiles and preferences
- **DownloadQueue**: Download tracking with torrent integration and status management
- **QualityProfiles**: User-defined quality preference definitions
- **SceneFiles**: Physical file tracking with hashes for content identification

### 4.2 Relationships

- **Performers ↔ Scenes**: Many-to-many relationship (a scene has multiple performers, a performer appears in multiple scenes)
- **Studios ↔ Scenes**: One-to-many relationship (a scene belongs to one studio)
- **Subscriptions ↔ Entities**: Polymorphic relationship (subscriptions can be for performers, studios, or scenes)
- **Scenes ↔ Files**: One-to-many relationship (a scene can have multiple file versions/qualities)
- **QualityProfiles ↔ Subscriptions**: One-to-many relationship (multiple subscriptions can use the same quality profile)

### 4.3 Key Data Features

- **Soft Deletes**: Critical entities use soft deletes for recovery
- **External ID Mapping**: Cross-referencing with TPDB, StashDB
- **Hash-based Deduplication**: oshash, MD5, perceptual hash support
- **Timestamps**: All entities track creation and update times
- **Hierarchical Organization**: Studio networks and parent studio relationships

---

## 5. User Interface

### 5.1 Layout and Navigation

#### 5.1.1 Main Layout

- **Sidebar Navigation**: Fixed sidebar with logo and menu items
- **Top Bar**: Breadcrumbs and page titles
- **Content Area**: Scrollable main content
- **Responsive Design**: Mobile-friendly with collapsible sidebar

#### 5.1.2 Navigation Structure

| Path | Page | Description |
|------|------|-------------|
| `/` | Dashboard | System overview and statistics |
| `/subscriptions` | Subscriptions | Manage all subscriptions |
| `/search` | Search | Discover and subscribe to content |
| `/downloads` | Downloads | Monitor and manage downloads |
| `/jobs` | Jobs | View background job status |
| `/logs` | Logs | System logs viewer |
| `/settings` | Settings | Application configuration |

### 5.2 Dashboard

#### 5.2.1 Statistics Cards

- **Active Subscriptions**: Total active subscriptions by type
- **Download Activity**: Active downloads, queue size, completion rate
- **Storage Overview**: Disk usage, free space, content distribution
- **Content Library**: Total scenes, downloaded files, quality breakdown

#### 5.2.2 Activity Feeds

- **Recent Downloads**: Last 10 completed downloads
- **Active Torrents**: Currently downloading with progress bars
- **Recent Jobs**: Last 5 background job executions

#### 5.2.3 System Status

- **Provider Connections**: Status of external services
- **Database Health**: Connection status
- **Disk Space**: Usage warnings
- **Job Scheduler**: Next scheduled runs

### 5.3 Subscriptions Page

#### 5.3.1 View Modes

- **Table View**: Dense data display with sorting
- **Card View**: Visual cards with images

#### 5.3.2 Filtering

- **Entity Type Tabs**: Performers, Studios, Scenes
- **Search**: Full-text search across names
- **Status Filter**: Active, Paused
- **Download Status**: All, Downloaded, Pending, None

#### 5.3.3 Subscription Cards/Rows

- Entity image/avatar
- Name and aliases
- Subscription status
- Scene count / download status
- Quick actions (pause, delete, view details)

#### 5.3.4 Subscription Detail View

- Entity information (performer/studio/scene details)
- Associated scenes with download toggle
- Subscription settings
- Quality profile selection
- Activity timeline

### 5.4 Search Page

#### 5.4.1 Search Interface

- **Search Bar**: Full-text search with autocomplete
- **Type Filter**: All, Performers, Studios, Scenes
- **Results**: Infinite scroll grid of result cards

#### 5.4.2 Result Cards

- Thumbnail/poster image
- Title/name
- Subtitle (studio, date for scenes)
- Subscription status indicator
- Hover actions (view details, subscribe)

#### 5.4.3 Detail Modals

**Performer Modal**:
- Image gallery
- Biography and attributes
- Scene count
- Subscription dialog with quality selection

**Studio Modal**:
- Studio information
- Parent studio/network
- Scene count
- Subscription dialog

**Scene Modal**:
- Scene details
- Performers
- Studio/network
- Release information
- Subscription dialog with quality selection

### 5.5 Downloads Page

#### 5.5.1 Statistics Panel

- **Active Downloads**: Count and total speed
- **Queue Size**: Pending items
- **Completed Today**: Count and size
- **Failed Items**: Count requiring attention

#### 5.5.2 Downloads Table

Columns:
- Scene title/studio
- Status with progress bar
- Quality information
- Download/upload speed
- ETA
- Actions (pause, resume, delete, retry, priority)

#### 5.5.3 Status Indicators

- **Pending**: Gray, awaiting search
- **Searching**: Blue, searching for torrents
- **Queued**: Yellow, in torrent client queue
- **Downloading**: Green with progress bar
- **Completed**: Green checkmark
- **Failed**: Red with error message
- **Paused**: Orange pause icon

### 5.6 Jobs Page

#### 5.6.1 Job List

- Job name and type
- Last execution time
- Status (success, failed, running)
- Duration
- Next scheduled run
- Actions (run now, view logs)

#### 5.6.2 Job Detail View

- Job configuration
- Execution history
- Progress tracking (for running jobs)
- Log output

### 5.7 Logs Page

#### 5.7.1 Log Viewer

- **Level Filter**: All, Info, Warn, Error, Debug
- **Search Filter**: Text search across logs
- **Time Range**: Date range picker
- **Auto-Refresh**: Optional live updates
- **Export**: Download logs as text file

#### 5.7.2 Log Display

- Timestamp
- Level indicator (color-coded)
- Message
- Context (collapsed by default)

### 5.8 Settings Page

#### 5.8.1 Settings Categories

| Category | Description |
|----------|-------------|
| General | Application name, base URL, timezone |
| Providers | External service configuration |
| Quality Profiles | Create and manage quality profiles |
| Download Paths | Configure destination directories |
| Speed Schedules | Time-based speed limiting rules |
| Torrent Management | Auto-management rules, retry settings |
| AI Models | Configure AI matching (optional) |
| Credentials | User account management |

#### 5.8.2 Providers Section

For each provider (Prowlarr, StashDB, TPDB, qBittorrent):
- Connection settings (URL, API key)
- Test connection button
- Status indicator
- Provider-specific options

#### 5.8.3 Quality Profiles Section

- List of profiles with create/edit/delete
- Default profile selection
- Profile items with quality, source, min seeders, max size, priority

#### 5.8.4 Download Paths Section

- Path templates for different content types
- Variable support (studio, performer, date, etc.)
- Path validation
- Directory creation options

#### 5.8.5 Speed Schedules Section

- Time-based rules for speed limiting
- Schedule grid (time vs. day)
- Speed limits for each schedule
- Enable/disable per schedule

---

## 6. API Overview

### 6.1 Authentication Endpoints

- `POST /auth/login` - Authenticate user and create session
- `POST /auth/logout` - End user session
- `GET /auth/status` - Check authentication status

### 6.2 Subscription Endpoints

- `GET /subscriptions` - List all subscriptions with optional filtering by entity type and status
- `POST /subscriptions` - Create new subscription
- `GET /subscriptions/:id` - Get subscription details with associated scenes
- `PATCH /subscriptions/:id` - Update subscription settings
- `DELETE /subscriptions/:id` - Delete subscription with optional file cleanup
- `POST /subscriptions/:id/toggle-status` - Activate or pause subscription
- `GET /subscriptions/check/:entityType/:entityId` - Check subscription status for an entity
- `GET /subscriptions/:id/scenes` - Get scenes for performer/studio subscriptions
- `GET /subscriptions/:id/files` - Get scene files for scene subscriptions

### 6.3 Search Endpoints

- `GET /search` - Search for content across all types with filters for type, pagination
- `GET /search/performers` - Search performers only
- `GET /search/studios` - Search studios only
- `GET /search/scenes` - Search scenes only

### 6.4 Download Queue Endpoints

- `GET /download-queue` - List download queue items with optional status filtering
- `GET /download-queue/unified` - Unified view combining database and qBittorrent data
- `POST /download-queue` - Add scene to download queue
- `GET /download-queue/:id` - Get download queue item details
- `PATCH /download-queue/:id` - Update queue item status
- `DELETE /download-queue/:id` - Remove from queue with optional file deletion
- `POST /download-queue/:id/pause` - Pause active download
- `POST /download-queue/:id/resume` - Resume paused download
- `POST /download-queue/:id/retry` - Retry failed download

### 6.5 Torrent Management Endpoints

- `GET /torrents` - List all torrents from qBittorrent
- `POST /torrents/:hash/pause` - Pause torrent
- `POST /torrents/:hash/resume` - Resume torrent
- `DELETE /torrents/:hash` - Remove torrent with optional file deletion
- `PATCH /torrents/:hash/priority` - Change torrent queue priority

### 6.6 Quality Profile Endpoints

- `GET /quality-profiles` - List all quality profiles
- `POST /quality-profiles` - Create quality profile
- `PATCH /quality-profiles/:id` - Update quality profile
- `DELETE /quality-profiles/:id` - Delete quality profile

### 6.7 Settings Endpoints

- `GET /settings` - Get all settings grouped by category
- `PATCH /settings` - Update settings
- `POST /settings/test/:provider` - Test connection to external provider

### 6.8 Job Endpoints

- `GET /jobs` - List all jobs with status
- `POST /jobs/:id/run` - Manually trigger job
- `GET /jobs/:id/progress` - Get real-time job progress (SSE stream)

### 6.9 Logging Endpoints

- `GET /logs` - Retrieve log entries with filtering by level, search, date range

---

## 7. Infrastructure Requirements

### 7.1 System Requirements

#### 7.1.1 Minimum Requirements

- **CPU**: 2 cores
- **RAM**: 4 GB
- **Storage**: 20 GB + content storage
- **OS**: Linux (Docker-compatible), Windows, or macOS

#### 7.1.2 Recommended Requirements

- **CPU**: 4+ cores
- **RAM**: 8 GB+
- **Storage**: SSD with 100 GB+ for content
- **Network**: Stable connection with unlimited data

#### 7.1.3 Optional Requirements

- **GPU**: For AI matching features (CPU fallback available)
- **VPN**: For privacy (optional)
- **Reverse Proxy**: Traefik, Nginx, or Caddy for SSL

### 7.2 Network Requirements

#### 7.2.1 External Service Connectivity

The system requires connectivity to:
- **TPDB/StashDB**: For metadata fetching
- **Prowlarr**: For torrent searching
- **Indexers**: Various torrent trackers (configured in Prowlarr)
- **qBittorrent**: Local service communication

#### 7.2.2 Port Configuration

Default ports (all configurable):
- **3000**: Frontend web interface
- **3001**: Backend API
- **8080**: qBittorrent Web UI
- **9696**: Prowlarr Web UI
- **8096**: Jellyfin (optional)

### 7.3 Storage Requirements

#### 7.3.1 Directory Structure

```
/var/lib/eros/
├── database/           # SQLite database files
├── config/            # Application configuration
├── logs/              # Application logs
└── media/             # Downloaded content
    ├── performers/    # Performer-organized content
    ├── studios/       # Studio-organized content
    └── scenes/        # Scene-organized content
```

#### 7.3.2 Storage Planning

- **Database**: ~100 MB (scales with content count)
- **Logs**: ~10 MB/day (with rotation)
- **Content**: Variable (1-10 GB per scene for HD content)

### 7.4 Backup Strategy

#### 7.4.1 Critical Data to Backup

1. **Database Files**: Complete SQLite database
2. **Configuration**: Application settings and credentials
3. **Downloaded Content**: If not redundant elsewhere

#### 7.4.2 Backup Recommendations

- **Database**: Daily automated backups
- **Config**: Version control or automated backup
- **Content**: User discretion based on library value

---

## 8. Security Considerations

### 8.1 Authentication & Authorization

#### 8.1.1 User Authentication

- **Session-based authentication** with secure cookies
- **Argon2id** password hashing (memory-hard, GPU-resistant)
- **Single-user model** (admin account only in v1.0)
- **Session timeout**: Configurable (default: 7 days)

#### 8.1.2 Future Multi-User Support (Planned)

- Role-based access control (RBAC)
- Per-user subscriptions and settings
- User-specific download paths
- Activity audit logs

### 8.2 API Security

#### 8.2.1 Input Validation

- **Zod schemas** validate all inputs
- **SQL injection protection** via parameterized queries
- **XSS prevention** with React's built-in escaping
- **CSRF protection** with same-site cookies

#### 8.2.2 Rate Limiting

- Configurable per-endpoint rate limits
- Prevents abuse of search and download endpoints
- IP-based limiting for anonymous requests

### 8.3 External Service Security

#### 8.3.1 API Key Storage

- API keys stored in database (encrypted at rest)
- Environment variables for initial configuration
- Never logged or exposed in error messages

#### 8.3.2 Provider Communication

- HTTPS-only connections to external services
- Certificate validation
- Timeout configurations to prevent hanging

### 8.4 Data Privacy

#### 8.4.1 User Data

- No telemetry or analytics (optional opt-in)
- No data shared with third parties
- User retains full control of their data

#### 8.4.2 Content Privacy

- All content stored locally
- No cloud storage dependencies
- Optional VPN support for torrent privacy

---

## 9. Performance Requirements

### 9.1 Response Time Targets

| Operation | Target | Maximum |
|-----------|--------|----------|
| Page load | < 1s | 3s |
| API response | < 200ms | 1s |
| Search query | < 500ms | 2s |
| Download queue update | < 100ms | 500ms |
| Database query | < 50ms | 200ms |

### 9.2 Scalability Targets

| Metric | Target |
|--------|--------|
| Concurrent users | 10 (single-user deployment) |
| Subscriptions | 1,000+ |
| Download queue | 500+ items |
| Scenes in database | 50,000+ |
| API requests/minute | 100+ |

### 9.3 Resource Limits

#### 9.3.1 Database Performance

- **Connection pooling**: 5-10 concurrent connections
- **Query optimization**: Indexed columns on frequently queried fields
- **N+1 prevention**: Eager loading for related entities

#### 9.3.2 Background Job Performance

- **Job concurrency**: Configurable (default: 1 job at a time)
- **Job timeout**: 30 minutes (configurable)
- **Retry limits**: Exponential backoff with max 5 retries

---

## 10. Monitoring and Observability

### 10.1 Logging

#### 10.1.1 Log Levels

- **DEBUG**: Detailed diagnostic information
- **INFO**: General informational messages
- **WARN**: Warning messages for potentially harmful situations
- **ERROR**: Error events that might still allow the application to continue

#### 10.1.2 Log Categories

- **HTTP**: Request/response logging
- **JOB**: Background job execution
- **EXTERNAL**: External service calls
- **DATABASE**: Database operations
- **ERROR**: Error stack traces and context

#### 10.1.3 Structured Logging

All logs include:
- Timestamp (ISO 8601)
- Log level
- Message
- Context object (relevant data)
- Request ID (for HTTP requests)

### 10.2 Metrics

#### 10.2.1 Application Metrics

- Active subscription count
- Download queue size and status
- Torrent client status
- Job execution times
- API response times
- Error rates

#### 10.2.2 System Metrics

- CPU usage
- Memory usage
- Disk usage
- Network I/O
- Database size

### 10.3 Health Checks

#### 10.3.1 Internal Health

- Database connectivity
- External service connectivity
- Disk space availability
- Background job scheduler status

#### 10.3.2 External Health

- qBittorrent connection
- Prowlarr connection
- Metadata provider connectivity

---

## 11. Deployment Guide

### 11.1 Initial Setup

#### 11.1.1 Prerequisites

1. Install Docker and Docker Compose
2. Clone repository
3. Configure environment variables
4. Run initial setup

#### 11.1.2 Environment Variables

Required variables:
```bash
# Security
SESSION_SECRET=           # Random 32+ character string
ADMIN_PASSWORD=           # Initial admin password

# Paths (optional, have defaults)
DATABASE_PATH=/var/lib/eros/database
MEDIA_PATH=/var/lib/eros/media

# Service URLs (optional, auto-discover in Docker network)
PROWLARR_URL=http://prowlarr:9696
QBITTORRENT_URL=http://qbittorrent:8080
```

### 11.2 Docker Deployment

#### 11.2.1 Quick Start

```bash
# Clone repository
git clone https://github.com/user/eros.git
cd eros

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start services
docker-compose up -d

# Run setup wizard
# Open http://localhost:3000/setup
```

#### 11.2.2 Service Management

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f eros-app

# Restart service
docker-compose restart eros-app

# Update to latest version
docker-compose pull
docker-compose up -d
```

### 11.3 Configuration Steps

#### 11.3.1 First Run Setup

1. Access web interface at http://localhost:3000
2. Create admin account
3. Configure external providers (Prowlarr, qBittorrent, metadata providers)
4. Set up quality profiles
5. Configure download paths
6. (Optional) Configure speed schedules

#### 11.3.2 Provider Configuration

**Prowlarr**:
1. Install and configure Prowlarr
2. Add indexers
3. Configure categories
4. Test connection from Eros settings

**qBittorrent**:
1. Install qBittorrent
2. Enable Web UI
3. Configure download paths
4. Test connection from Eros settings

**Metadata Providers**:
1. Obtain API keys for TPDB/StashDB
2. Configure in Eros settings
3. Test connections

### 11.4 Upgrades

#### 11.4.1 Upgrade Process

```bash
# Pull latest changes
git pull

# Pull new Docker images
docker-compose pull

# Restart services
docker-compose up -d

# Run database migrations if needed
docker-compose exec eros-app pnpm db:push
```

#### 11.4.2 Rollback

```bash
# Checkout previous version
git checkout <previous-tag>

# Restart with previous version
docker-compose up -d
```

---

## 12. Future Roadmap

### 12.1 Planned Features

#### 12.1.1 Short Term (Next 3 Months)

1. **Multi-User Support**
   - Role-based access control
   - Per-user subscriptions and settings
   - Activity audit logs

2. **Enhanced Search**
   - Advanced filters
   - Saved searches
   - Search history



#### 12.1.2 Medium Term (3-6 Months)

1. **Additional Torrent Clients**
   - Deluge integration
   - rTorrent integration
   - Transmission integration

2. **Advanced Matching**
   - Machine learning scene matching
   - Fuzzy matching improvements
   - Cross-reference verification



#### 12.1.3 Long Term (6+ Months)



1. **Advanced Automation**
   - Custom workflows
   - Webhook support
   - API for third-party integrations

### 12.2 Technical Debt

#### 12.2.1 Known Issues

1. Some legacy endpoints don't follow Clean Architecture
2. Limited error recovery in some jobs
3. Manual testing requirements for some features

#### 12.2.2 Refactoring Priorities

1. Complete migration to Clean Architecture
2. Comprehensive test coverage
3. Performance optimization for large datasets
4. Enhanced error handling and recovery

---

## 13. Appendix

### 13.1 Glossary

| Term | Definition |
|------|------------|
| Performer | An actor/actress in adult content |
| Studio | Production company or network |
| Scene | Individual video content |
| Subscription | Automated monitoring of entity for new content |
| Quality Profile | User-defined download quality preferences |
| Indexer | Torrent tracker or search service |
| Metadata Provider | External API for content information |
| Hash | Unique identifier for file content (oshash, MD5, phash) |
| Seeder | Peer sharing complete torrent file |

### 13.2 External References

- **Next.js Documentation**: https://nextjs.org/docs
- **Fastify Documentation**: https://fastify.dev/docs
- **Drizzle ORM**: https://orm.drizzle.team/docs
- **Prowlarr**: https://wiki.servarr.com/prowlarr
- **qBittorrent**: https://www.qbittorrent.org/
- **Prowlarr Api referance** : https://prowlarr.com/docs/api/#/
- **TPDB Api referance** : https://api.theporndb.net/docs
- **qbittorrent Api referance** : https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-5.0)


### 13.3 License

[Specify license - e.g., MIT, AGPL, etc.]

### 13.4 Support

- **Documentation**: [Project Wiki/Docs URL]
- **Issues**: [GitHub Issues URL]
- **Discussions**: [GitHub Discussions URL]
- **Discord**: [Community Discord URL]



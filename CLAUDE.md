# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Eros is an **adult content automation platform** featuring performer/studio/scene subscription management, intelligent torrent search, and automated downloading with metadata management.

This is a TypeScript monorepo using Turborepo and pnpm workspaces. The project consists of:
- **Frontend**: Next.js 15 with React 19, App Router, Tailwind CSS
- **Backend**: Fastify with TypeScript, Zod validation, Pino logging
- **Shared Packages**: Database schema, shared types, TypeScript configs

## Tech Stack

- **Monorepo**: Turborepo + pnpm (v9.15.0+)
- **Node**: v20+
- **Frontend**: Next.js 15 + React 19 + TanStack Query + Zustand
- **Backend**: Fastify + fastify-type-provider-zod + Pino
- **Database**: SQLite + Drizzle ORM + better-sqlite3
- **UI**: Radix UI + Tailwind CSS + Shadcn UI patterns
- **External Services**: qBittorrent, Prowlarr, StashDB GraphQL API
- **AI**: Xenova/transformers (optional)

## Project Structure

```
.
├── apps/
│   ├── web/              # Next.js frontend (port 3000)
│   ├── server/           # Fastify backend (port 3001)
│   └── data/             # Data processing/background jobs
├── packages/
│   ├── database/         # Drizzle ORM schema + migrations
│   ├── shared-types/     # TypeScript types shared across apps
│   └── typescript-config/ # Shared tsconfig.json files
├── docker-compose.yml    # Docker setup for deployment
└── turbo.json            # Turborepo pipeline configuration
```

## Monorepo Commands

### Running Development Servers

```bash
# Run all dev servers
pnpm turbo dev

# Run specific workspace
pnpm turbo dev --filter=web
pnpm turbo dev --filter=server
```

### Building

```bash
# Build all apps
pnpm turbo build

# Build specific app
pnpm turbo build --filter=web
pnpm turbo build --filter=server
```

### Type Checking

```bash
# Type check all workspaces
pnpm turbo tsc
```

### Linting

```bash
# Lint all workspaces
pnpm turbo lint

# Lint with auto-fix
pnpm turbo lint --fix
```

### Formatting

```bash
# Format all files
pnpm format

# Check formatting without changing files
pnpm format:check
```

### Adding Dependencies

```bash
# Add to specific workspace
pnpm add <package> --filter=<workspace>

# Add workspace dependency
pnpm add @repo/database --filter=web --workspace
```

### Database Management

```bash
# Generate Drizzle migrations
pnpm db:generate
# Or: pnpm --filter=@repo/database db:generate

# Push schema changes to database (no migration files)
pnpm db:push
# Or: pnpm --filter=@repo/database db:push

# Open Drizzle Studio (database GUI)
pnpm --filter=@repo/database db:studio
```

### Server-Specific Commands

```bash
# Run server in watch mode
pnpm --filter=server dev

# Build server
pnpm --filter=server build

# Run settings migration script
pnpm --filter=server migrate:settings
```

## Docker Development

The project includes Docker Compose setup for deployment:

```bash
# Start all services
docker-compose up -d

# View logs
docker logs <container-name>

# Stop all services
docker-compose down
```

**Services exposed:**
- Web UI: http://localhost:3000
- API: http://localhost:3001
- qBittorrent: http://localhost:8080
- Prowlarr: http://localhost:9696

## Architecture Principles

### Clean Architecture (Backend) - MANDATORY FOR ALL NEW ENDPOINTS

**The backend follows Clean Architecture with strict layered separation. ALL new endpoints MUST follow this pattern:**

```
Route → Controller → Service → Repository → Database/External API
```

#### Layer Responsibilities:

1. **Routes (Fastify plugins)** - `src/modules/{module}/{module}.routes.ts`
   - Pure HTTP routing only
   - Get controller from DI container: `const { moduleController } = app.container`
   - Delegate all logic to controller
   - Define OpenAPI/Swagger schemas
   - Handle HTTP error codes (404, 400, etc.)
   - **NO business logic, NO database access, NO service calls directly**

2. **Controllers** - `src/interfaces/controllers/{module}.controller.ts`
   - HTTP request/response handling
   - Request validation using Zod schemas
   - Call service methods
   - Format responses
   - Error handling and mapping
   - **HTTP concerns only** (sessions, SSE setup, plugin reloading)
   - **NO business logic, NO database access**

3. **Services** - `src/application/services/{module}.service.ts`
   - Business logic layer
   - Framework-agnostic (no Fastify dependencies)
   - Orchestrates multiple repositories
   - Handles external API calls
   - Implements business rules and validation
   - **NO HTTP concerns, NO direct database access**

4. **Repositories** - `src/infrastructure/repositories/{module}.repository.ts`
   - Data access layer only
   - Direct database queries using Drizzle ORM
   - CRUD operations
   - Complex queries with joins
   - **NO business logic, pure data access**
   - Return `null` for not found, not throw errors

5. **Dependency Injection** - `src/container/`
   - All components registered in Awilix container
   - Constructor injection for all dependencies
   - Three registration blocks: Repositories → Services → Controllers

#### Example Implementation:

```typescript
// 1. Repository (Infrastructure Layer)
export class UsersRepository {
  constructor(private db: Database) {}

  async findById(id: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, id),
    });
    return user || null;
  }
}

// 2. Service (Application Layer)
export class UsersService {
  constructor(
    private usersRepo: UsersRepository,
    private logger: Logger
  ) {}

  async getUserById(id: string) {
    const user = await this.usersRepo.findById(id);
    if (!user) {
      throw new Error("User not found");
    }
    // Business logic here
    return user;
  }
}

// 3. Controller (Interface Layer)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private logger: Logger
  ) {}

  async getById(params: { id: string }) {
    return await this.usersService.getUserById(params.id);
  }
}

// 4. Routes (HTTP Layer)
const usersRoutes: FastifyPluginAsyncZod = async (app) => {
  const { usersController } = app.container;

  app.get("/:id", {
    schema: {
      params: z.object({ id: z.string() }),
      response: { 200: UserSchema, 404: ErrorResponseSchema },
    },
  }, async (request, reply) => {
    try {
      return await usersController.getById(request.params);
    } catch (error) {
      if (error instanceof Error && error.message === "User not found") {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  });
};

// 5. DI Registration (container/index.ts)
container.register({
  usersRepository: asClass(UsersRepository).scoped(),
  usersService: asClass(UsersService).scoped(),
  usersController: asClass(UsersController).scoped(),
});
```

#### Important Design Decisions:

- **No Repository needed**: If module only uses external APIs (e.g., Torrents uses QBittorrentService)
- **HTTP concerns stay in Controller**: Session management, SSE setup, Fastify plugin reloading
- **External service delegation**: Services can delegate to external APIs (TPDB, StashDB, etc.)
- **Naming conflicts**: Use prefixes like `newLogsService` during migration to avoid conflicts
- **Error handling**: Repositories return `null`, Services throw errors, Controllers map to HTTP codes

### Legacy Code Migration (In Progress)

**DO NOT** create new endpoints using the old pattern:
- ❌ Direct database access in routes
- ❌ Factory functions like `createService(app.db)`
- ❌ Business logic in route handlers

**Always use Clean Architecture for new code.**

### Feature-Based Architecture (Frontend)

The frontend uses a Feature-Based Architecture to organize code by domain domain rather than technical type.

```
src/
├── app/                 # Next.js App Router (pages/layouts)
├── components/          # Shared UI components (dumb components)
├── features/            # Feature-based modules
│   └── torrent-search/  # Example Feature
│       ├── components/  # Feature-specific components
│       ├── hooks/       # Feature-specific hooks
│       ├── types/       # Feature-specific types
│       └── utils/       # Feature-specific utilities
├── hooks/               # Shared hooks
└── lib/                 # Shared libraries/utils
```

### Component Guidelines

- **Default to Server Components (RSC)**: Only add `'use client'` when using hooks or event listeners
- **Server Actions**: Use for all data mutations instead of API Routes
- **URL as Source of Truth**: Store filters, pagination, search, tabs in URL search params, not useState
- **Composition over Configuration**: Avoid boolean props, prefer composable component patterns

### Database Best Practices

- **Always use transactions** when performing multiple write operations
- **Prevent N+1 queries**: Use JOIN or ORM eager loading
- **Soft deletes**: Use `deletedAt` timestamp instead of DELETE for critical data

## Database Package

The `@repo/database` package exports:
- **Main entry**: Database client and query utilities
- **`/schema`**: Drizzle table definitions

```typescript
// Import database client
import { db } from '@repo/database'

// Import schema tables
import { users, scenes, performers } from '@repo/database/schema'
```

## TypeScript Standards

### Critical Rules

- **NO ENUMS**: Use `const` objects with `as const` or string literal unions
- **NO `any`**: Use `unknown` and narrow types with type guards
- **Explicit return types** for all exported functions
- **Named arguments**: Use object parameters for functions with >2 parameters
- Use `satisfies` operator to validate expressions without widening types
- Derive types from Zod schemas: `type User = z.infer<typeof UserSchema>`

### Type Definition Conventions

- PascalCase for types/interfaces
- NO `I` prefix (use `User`, not `IUser`)
- Prefer `type` over `interface` (unless declaration merging needed)

## Next.js 15 Breaking Changes

### Async Params & SearchParams

In Next.js 15, these are Promises and MUST be awaited:

```typescript
// CORRECT
export default async function Page({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { query } = await searchParams;
}
```

### React 19 Changes

- Use `useActionState` (from `react`) instead of deprecated `useFormState`
- Use `useFormStatus` for loading states in forms
- `fetch` is no longer cached by default - explicitly set `cache: 'force-cache'` if needed

## Fastify Patterns

### Type-Safe Routing

Always use `fastify-type-provider-zod`:

```typescript
import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const userRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post("/", {
    schema: {
      body: z.object({ email: z.string().email() }),
      response: { 201: z.object({ id: z.string() }) }
    }
  }, async (request, reply) => {
    // request.body is automatically typed
  });
};
```

### Application Structure

```text
src/
  ├── app.ts            # App factory
  ├── server.ts         # Entry point
  ├── container/        # DI Container registration
  ├── plugins/          # Global plugins
  ├── interfaces/       # Presentation Layer (Controllers)
  │   └── http/         # HTTP Controllers
  ├── application/      # Application Layer (Use Cases/Services)
  │   └── services/     # Business Logic
  └── infrastructure/   # Infrastructure Layer
      ├── repositories/ # Data Access
      └── external/     # External APIs (e.g. StashDB)
```

## Security Requirements

### Authentication & Authorization

- **Never store passwords in plain text**: Use Argon2id or Bcrypt
- **Rate limiting**: Required on all public endpoints
- **Secrets**: Never hardcode, only via `process.env`, validate at startup with Zod

### OWASP Compliance

Before implementation, evaluate:
1. **Security Impact**: Does this introduce IDOR, SQL Injection, or XSS vulnerabilities?
2. **Scalability**: Will this query fail with large datasets? (Prevent N+1)
3. **Atomicity**: Does this modify multiple tables? Wrap in transaction

### Input Validation

- Validate on **both** client (UX) and server (security)
- Use Zod schemas consistently across frontend and backend
- Never use `dangerouslySetInnerHTML` without strict sanitization

## Styling with Tailwind

### Core Principles

- **Mobile-first**: Write mobile styles first, use breakpoints for larger screens
- **Semantic colors**: Use `bg-primary`, `text-muted-foreground` instead of `bg-blue-600`
- **cn utility**: Always use for conditional classes, never string interpolation
- **Avoid @apply**: Keep styles in JSX for locality of behavior

### Dynamic Classes

```tsx
import { cn } from "@/lib/utils"

// CORRECT
<div className={cn(
  "p-4 rounded-lg bg-white",
  isActive ? "border-2 border-primary" : "border border-gray-200"
)} />

// WRONG - Tailwind scanner cannot detect
<div className={`p-4 bg-${color}-500`} />
```

## Date & Time Handling

- **Database**: Always store in UTC (`timestamp with time zone`)
- **Backend logic**: Always calculate in UTC
- **Frontend**: Only convert to user timezone at presentation layer
- **Libraries**: Use `date-fns` or native `Date`

## State Management (Frontend)

- **Server State**: Use TanStack Query, SWR, or Next.js cache (NOT Redux/Zustand)
- **Client State**: Use `useState` or `useReducer` for UI interactions
- **Global State**: Only for truly global data (Theme, Auth Session) - use Context or Zustand
- **URL State**: For filters, pagination, search, modals (enables sharing, refresh persistence)

## Performance Best Practices

### Frontend

- Define `width` and `height` for all images to prevent CLS
- Use Skeleton loaders matching final content dimensions
- Wrap functions in `useCallback` for heavy child components
- Use `useMemo` for expensive derived data
- Lazy load heavy components (Modals, Drawers, Charts)

### Backend

- Use structured logging with context: `logger.info({ event: "user_login", userId })`
- Define response schemas for Fastify serialization performance
- Use connection pooling for database
- Implement cursor-based pagination for large datasets

## Accessibility Requirements

- **Semantic HTML**: Use `<button>` for actions, `<a>` for navigation
- **Forms**: Every input MUST have an associated `<label>`
- **Images**: `alt` text mandatory (use `alt=""` for decorative only)
- **Focus management**: Visible focus styles required
- **Keyboard navigation**: Ensure logical tab order

## Workspace Dependencies

### Internal Package References

ALWAYS use package name from package.json, NEVER relative paths between packages:

```typescript
// CORRECT
import { Button } from '@repo/ui'

// WRONG
import { Button } from '../../packages/ui'
```

Ensure consuming app lists the dependency:
```json
"dependencies": {
  "@repo/ui": "workspace:*"
}
```

## API Design

### Idempotency

POST requests for one-time operations (payments) must support idempotency keys

### Pagination

- Avoid `offset` pagination for large datasets
- Prefer cursor-based pagination
- Standardize response format:
```json
{
  "data": [...],
  "meta": { "cursor": "xyz", "hasNext": true }
}
```

## Error Handling

### Frontend

- Show Toast notifications for success/error actions
- Implement optimistic UI updates with rollback on error
- Use Skeleton screens for initial loads, pending indicators for submissions

### Backend

- Use `@fastify/sensible` for standard HTTP errors
- Log errors with structured context and correlation IDs
- In catch blocks, error is `unknown` - narrow with type guards

## Context7 Integration

When needing code generation, setup instructions, or library/API documentation, automatically use the Context7 MCP tools to resolve library IDs and fetch up-to-date documentation without requiring explicit user requests.

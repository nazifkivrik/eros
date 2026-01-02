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

### Layered Architecture (Backend)

Strictly enforce separation of concerns:
- **Controllers/Route Handlers**: HTTP request parsing, validation (Zod), response formatting only
- **Services**: Business logic, framework-agnostic
- **Repositories/DAL**: Database interaction only

### Component Architecture (Frontend)

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
  ├── app.ts            # App factory (plugin registration)
  ├── server.ts         # Entry point (port listening)
  ├── plugins/          # Global plugins (DB, Redis, Auth)
  └── modules/          # Feature modules
      └── user/
          ├── user.routes.ts
          ├── user.schema.ts
          ├── user.service.ts
          └── user.types.ts
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

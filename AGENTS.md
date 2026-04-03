# AGENTS.md - Eros Codebase Agent Guidelines

## Project Overview

Eros is an adult content automation platform monorepo using:
- **Frontend**: Next.js 15 + React 19 (port 3000)
- **Backend**: Fastify + TypeScript (port 3001)
- **Database**: SQLite + Drizzle ORM
- **Monorepo**: Turborepo + pnpm workspaces

---

## Build/Lint/Test Commands

### Monorepo (run from root)

```bash
pnpm turbo dev              # Run all dev servers
pnpm turbo build            # Build all workspaces
pnpm turbo lint             # Lint all workspaces
pnpm turbo test             # Test all workspaces
pnpm turbo clean            # Clean all workspaces
pnpm format                 # Format all files with Prettier
```

### Server (apps/server)

```bash
pnpm --filter=server dev                    # Watch mode
pnpm --filter=server build                  # Production build
pnpm --filter=server lint                   # ESLint

# Testing
pnpm --filter=server test                   # Run all tests
pnpm --filter=server test:watch             # Watch mode
pnpm --filter=server test:ui                # Vitest UI
pnpm --filter=server test:coverage          # Coverage report

# Single test file
pnpm vitest run src/modules/torrent/torrent.service.test.ts

# Database
pnpm --filter=@repo/database db:generate    # Generate migrations
pnpm --filter=@repo/database db:push        # Push schema
pnpm --filter=@repo/database db:studio       # Drizzle Studio
```

### Web (apps/web)

```bash
pnpm --filter=web dev                        # Next.js dev server
pnpm --filter=web build                      # Next.js build
pnpm --filter=web lint                        # Next.js lint
```

---

## Code Style Guidelines

### TypeScript Rules (CRITICAL)

- **NO ENUMS** - Use `const` objects with `as const` or string literal unions
- **NO `any`** - Use `unknown` and narrow with type guards
- **NO `I` prefix** - Use `User`, not `IUser`
- **Use `satisfies`** - Validate without widening inferred types
- **Explicit return types** - Required for all exported functions
- **Named arguments** - Use object destructuring for >2 parameters

```typescript
// ❌ AVOID
enum Role { Admin = "ADMIN", User = "USER" }
function createUser(name: string, email: string, age: number) {}

// ✅ PREFERRED
export const ROLES = { ADMIN: "ADMIN", USER: "USER" } as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];
interface CreateUserParams { name: string; email: string; age: number; }
function createUser({ name, email, age }: CreateUserParams) {}
```

### Imports & Module Resolution

- **Workspace packages**: Always use package name (e.g., `@repo/database`, `@repo/shared-types`)
- **Never use relative paths** between packages
- **Path aliases**: Use `@/` for local imports (`@/application/services`)

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `user-service.ts`, `torrent-routes.ts` |
| Components | PascalCase | `UserProfile.tsx` |
| Types/Interfaces | PascalCase | `CreateUserParams` |
| Variables/Functions | camelCase | `getUserById` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Enums (if needed) | PascalCase | `UserRole` with string values |

### Backend Architecture (Clean Architecture - MANDATORY)

```
Routes → Controller → Service → Repository → Database
```

- **Routes**: HTTP routing only, get controller from DI container
- **Controllers**: HTTP concerns (request/response), Zod validation
- **Services**: Business logic, framework-agnostic
- **Repositories**: Data access only, return `null` for not found

### Frontend Architecture

- **Default to Server Components** - Add `'use client'` only when needed
- **URL as Source of Truth** - Store filters/pagination in URL params
- **Server Actions** - Use for data mutations instead of API routes
- **Async Params** - `await params` and `await searchParams` in Next.js 15

### Error Handling

```typescript
// Backend: Repositories return null, Services throw, Controllers map to HTTP codes
// Catch blocks: error is unknown - always narrow type

try {
  await doSomething();
} catch (error) {
  if (error instanceof Error) {
    request.log.error({ err: error }, error.message);
  }
}
```

### Formatting

- **Prettier** for all formatting (configured in root)
- **2 spaces** indentation (project standard)
- **Single quotes** for strings
- **Trailing commas** in multiline

### Database

- **UTC only** - Store and calculate in UTC
- **Transactions** - Always wrap multiple writes
- **Soft deletes** - Use `deletedAt` timestamp
- **N+1 prevention** - Use JOINs/eager loading

### Security

- **Never hardcode secrets** - Use `process.env` only
- **Validate env vars** at startup with Zod
- **Password hashing** - Use Argon2id or Bcrypt
- **Rate limiting** - Required on public endpoints
- **Input validation** - Both client (UX) and server (security)

### Testing (Server)

- Use **Vitest** with `tap` style
- Test against `buildApp()` factory with `app.inject()`
- Coverage thresholds: 70% statements/branches/lines/functions

---

## Project Structure

```
apps/
  ├── web/              # Next.js 15 frontend
  └── server/           # Fastify backend
packages/
  ├── database/         # Drizzle ORM schema
  ├── shared-types/     # TypeScript types
  └── typescript-config/ # Shared tsconfig files
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Run all dev | `pnpm turbo dev` |
| Single test | `pnpm vitest run <path>` |
| Add dependency | `pnpm add <pkg> --filter=<app>` |
| Add workspace dep | `pnpm add @repo/pkg --filter=<app> --workspace` |
| Generate migrations | `pnpm --filter=@repo/database db:generate` |

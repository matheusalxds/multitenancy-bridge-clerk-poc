# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PoC validating two things together (see README.md for outcomes and bridge limitations):

1. The "bridge" multi-tenancy model with NestJS + Mongoose: one MongoDB cluster, one logical database per tenant (`tenant_acme`, `tenant_xyz`) selected per request via `connection.useDb(dbName, { useCache: true })`. Domain queries carry **no tenant filter**; the database boundary is the isolation.
2. Tenant derived from a **verified Clerk JWT claim**, never from a client-declared header. A client-declared tenant (`x-tenant-id` header or `tenantId` query param) is only a selector: mismatch with the claim → 403.

## Commands

pnpm only (npm is blocked by a hook). Turbo orchestrates tasks across packages.

```bash
pnpm install
pnpm build               # turbo build (env-config tsc + nest build + next build)
pnpm test                # unit suites, no Mongo needed
pnpm test:e2e            # REQUIRES the Tilt Mongo up; runs with NODE_ENV=test
pnpm lint                # oxlint (api, env-config) + eslint (web)
pnpm dev:tilt            # tilt up: Mongo on k8s (port-forwarded to :27017) + seed + API :3000 + web :3001
pnpm dev:tilt:down
pnpm dev                 # API only; pnpm web-dev for the web app
pnpm seed                # reseed platform tenants/users + per-tenant loanApplications
```

Single test file (run from the package dir):

```bash
cd apps/api && pnpm exec vitest run src/auth/clerk-auth.guard.spec.ts
cd apps/api && NODE_ENV=test pnpm exec vitest run --config ./vitest.config.e2e.ts test/loan-applications.e2e-spec.ts
```

Unit specs are `src/**/*.spec.ts`; e2e specs are `test/*.e2e-spec.ts` with their own vitest config and need Mongo on localhost:27017 (`tilt up`; Tilt port-forwards the in-cluster Mongo to the default port). Local k8s is OrbStack (context `orbstack`). API unit specs mock dependencies with `vitest-mock-extended` (`mock<T>()`, no `as unknown as` casts).

## Clerk instance (dev)

The project is linked to the Clerk app via the Clerk CLI (`clerk doctor` from `apps/web` to check). Instance state that the PoC depends on, all applied via CLI and documented with the exact commands in README.md: Organizations enabled (`clerk enable orgs`), email + password enabled via `clerk config patch`, `auth_email.sign_in_strategies` kept EMPTY and `auth_password.device_trust` disabled. The last two matter: the seeded test users have fake emails that cannot receive codes, so any config that offers or demands an email code at sign-in (code-as-factor, new-device verification) dead-ends the login. Test logins are printed at the end of `pnpm seed`.

## Secrets and env layout

CRITICAL RULE (from the PoC prompt): entity identifiers are data, not configuration. No `org_...`, `user_...` or tenant id may exist in env vars or be compared in runtime code; the only Clerk env vars are the instance keys. The seed provisions orgs/users via the Clerk Backend API (idempotent) and registers the returned ids in `platform.tenants`/`platform.users`; runtime always resolves identifiers via verified claim → Mongo lookup. Real Clerk keys live only in gitignored files: `apps/api/.env` and `apps/web/.env` (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`); never move them into the committed `.env.local` (the Clerk CLI's `env pull`/`init` writes there by default, relocate after). The committed `.env.local`/`.env.test` files hold only localhost values. The API's ConfigModule loads `[.env.<NODE_ENV>, .env]`; `apiEnvSchema` (packages/env-config) fails the boot unless `CLERK_SECRET_KEY` or `CLERK_JWT_KEY` is present. `CLERK_JWT_KEY` (PEM public key) enables networkless verification and is how the e2e suite injects its own throwaway key pair, signing real RS256 JWTs with `jose`; never "fix" those tests by mocking `verifyToken`, the real signature check is the point.

## Architecture

pnpm workspaces + Turborepo (`apps/*`, `packages/*`). The api and packages are ESM (`module: nodenext`, relative imports need the `.js` suffix); `apps/web` uses bundler resolution (no suffix).

Request flow for `/loan-applications`:

1. `ClerkAuthGuard` (global `APP_GUARD`, apps/api/src/auth/) extracts the Bearer token, verifies it via `TokenVerifierService` (`@clerk/backend` `verifyToken`), reads the claims only after verification, resolves org → tenant through `TenantsService.findByClerkOrgId` (60s in-memory cache, invalidated on tenant writes), rejects client-declared tenant mismatches, then writes `request.tenantId`/`request.userId`. Routes opt out with `@Public()` (health route, tenants CRUD). The organization claim is read ONLY from the nested v2 session-token shape (`o: { id }`, what current Clerk instances emit); support for the legacy flat `org_id` was deliberately removed (YAGNI), so e2e tokens are signed with the nested shape too, keeping synthetic tokens identical to real ones.
2. `TenantConnectionService` (request-scoped, apps/api/src/tenancy/) derives the tenant database name (`TENANT_DB_PREFIX` + tenantId) from the request and returns models bound to that database, cached per database connection.
3. `LoanApplicationsService` queries with zero tenant filters; documents have no tenant field (an e2e test asserts this).

CRITICAL RULE: the tenant handle travels only through the request (DI of the request-scoped service). Never store the current tenant or a tenant db handle in a module-level variable or singleton. The concurrency e2e test (40 interleaved requests) catches exactly that regression.

Platform vs tenant data: the `platform` database (control plane) holds the `tenants` registry (`clerkOrgId` unique → tenant database mapping) and the global `users` directory (`clerkUserId` unique, `tenantId` reference). Everything tenant-owned lives in per-tenant databases. `TenantsService`/`UsersService` bind their models to the platform db at construction time (safe: the platform db is fixed, not per request).

Error contract: domain errors (apps/api/src/common/domain-errors.ts) map to HTTP in `GlobalExceptionFilter`, registered via `APP_FILTER` (and `ValidationPipe` via `APP_PIPE`) so they apply in e2e tests, which bypass `main.ts`. Shape is always `{ error: { code, message, details? } }`. Mappings: `UnauthenticatedError` 401, `TenantMismatchError`/`TenantNotRegisteredError` 403, `EntityNotFoundError` 404 (cross-tenant lookups must surface as 404, never 403, to avoid leaking existence), `BusinessRuleViolationError` 422.

Web (`apps/web`, Next.js 16 App Router, cacheComponents mode): Clerk handles auth (`ClerkProvider` in layout, `clerkMiddleware` in `proxy.ts`, `<SignIn />` route). The dashboard is a Server Component that calls the API with the token from `auth().getToken()` (`lib/api.ts`, always `cache: 'no-store'`); the web app does NOT touch Mongo. Per-tenant/session data must never move to `"use cache"` (shared across requests).

## Gotchas

- cacheComponents mode: any page doing uncached IO must `await connection()` (from `next/server`) before the IO, even if it already reads cookies/auth; client components using URL hooks (Clerk's `<SignIn />` uses `usePathname`) additionally need `export const instant = false` on the route, Suspense alone was not enough.
- The base Mongo connection is one provider (`MONGO_CONNECTION` symbol); `useDb` with `useCache` shares its socket pool, so there is no per-tenant pool.
- `scripts/seed.ts` runs under plain `node` (type stripping): keep it erasable TypeScript, no decorators, imports only from built package dists. Seed order matters: `deleteMany` before `createIndex` (old documents without the new unique field break index builds).
- `test/config.e2e-spec.ts` mutates `process.env` and dynamically imports `AppModule` (ConfigModule validates at import time); `loan-applications.e2e-spec.ts` also dynamic-imports `AppModule` after setting `CLERK_JWT_KEY`. Both rely on vitest per-file process isolation; don't merge e2e files.
- `tenants` CRUD is `@Public()` on purpose (PoC admin surface); don't "fix" it by putting it behind the org-scoped guard, that would make bootstrap of the first tenant impossible.
- vitest-mock-extended: `mockDeep` auto-mocks nested PROPERTIES, not function RETURN VALUES; `mockDeep<ExecutionContext>().switchToHttp().getRequest` is undefined. Configure returns explicitly (`context.switchToHttp.mockReturnValue(httpHost)`), see clerk-auth.guard.spec.ts.

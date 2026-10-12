# PoC: Multi-tenancy (bridge model) + Multi-environment + Clerk

NestJS + Mongoose proof of concept for two decisions at once:

1. **Bridge isolation model**: one MongoDB cluster, one logical database per tenant (`tenant_acme`, `tenant_xyz`), selected per request via `connection.useDb(dbName, { useCache: true })`. Domain queries carry no tenant filter, the database boundary is the isolation.
2. **Tenant from a signed claim, not a header**: the front authenticates with Clerk, the session JWT (claim `org_id`) travels as `Authorization: Bearer`, and the API verifies the signature before deriving the tenant. No endpoint trusts a client-declared tenant; a declared tenant is only a selector and any mismatch with the claim is rejected with 403.

## Structure

pnpm workspaces + Turborepo:

- `apps/api`: NestJS 12 API (Nest CLI scaffold, ESM, Vitest)
- `apps/web`: Next.js 16 App Router app with Clerk login (port 3001), calls the API with the Clerk token
- `packages/env-config`: shared Zod env schemas (`envSchema`, `apiEnvSchema`) + fail-fast validators
- `k8s/` + `Tiltfile`: MongoDB on local Kubernetes, port-forwarded by Tilt to the default `localhost:27017`

Key pieces in `apps/api/src`:

- `auth/clerk-auth.guard.ts`: global guard; verifies the Bearer token with `@clerk/backend` (`verifyToken`, networkless with `CLERK_JWT_KEY` or cached JWKS with `CLERK_SECRET_KEY`), reads `org_id`/`sub` only after verification, resolves org → tenant through the `tenants` registry (cached 60s), rejects client-declared tenant mismatches (403) and attaches `{ tenantId, userId }` to the request. Routes opt out with `@Public()`.
- `tenants/`: tenant CRUD on the shared `platform` database; schema `{ tenantId, clerkOrgId (unique), name, status }`. This is the registry mapping Clerk organizations to tenant databases. Public in this PoC (admin surface, auth for it is out of scope).
- `users/`: platform users on the `platform` database, `{ clerkUserId (unique), tenantId, email, name, role }`; `GET /users/me` resolves the caller by the verified `sub` claim.
- `tenancy/tenant-connection.service.ts`: request-scoped; resolves the tenant database handle from the request (never from module/global state) and caches Mongoose models per database.
- `loan-applications/`: sample CRUD whose queries have no `tenantId` anywhere.
- `env/env.service.ts`: typed access over `@nestjs/config`, validated fail-fast at boot by `@poc/env-config` (`apiEnvSchema` requires `CLERK_SECRET_KEY` or `CLERK_JWT_KEY`).

## Clerk setup (one time)

The seed is self-sufficient: given only the instance keys, it creates the organizations and test users through the Clerk Backend API and registers the returned ids in Mongo. Entity ids (`org_...`, `user_...`) never live in env vars; the only Clerk env vars are the instance keys. Setup with the Clerk CLI:

```bash
clerk auth login
cd apps/web && clerk init --app <your_app_id>       # installs SDK config and writes the instance keys
clerk enable orgs --yes
```

Then make sure the keys land in the gitignored files (`clerk init` may write them to `.env.local`; move them, since `.env.local` is committed in this repo):

- `apps/web/.env`: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `apps/api/.env`: `CLERK_SECRET_KEY`

If the instance was created blank (no identifiers), enable email + password once: `clerk config patch --json '{"auth_email":{"used_for_sign_in":true,"used_for_sign_up":true,"required_for_sign_up":true,"verify_at_sign_up":true,"sign_in_strategies":[],"verification_strategies":["email_code"]},"auth_password":{"enabled":true,"required":true,"min_length":8,"device_trust":{"enabled":false}}}' --yes`. Two traps for the seeded fake emails, both dead ends since they cannot receive codes: `sign_in_strategies` must stay empty (with `email_code` there, the sign-in component offers a one-time code by email as a login factor) and `device_trust` must be disabled (it demands an email code on every sign-in from a new device, even with the right password).

Finally run `pnpm seed`. It prints the web test logins at the end (`alice@acme.com` and `xavier@xyz.com`, password `Poc-Bridge-2026-Strong!`). The test organizations and users exist only in your own dev instance and only after the seed runs; they are disposable, and re-running the seed is idempotent (it recreates anything deleted and re-registers the returned ids in Mongo). A new tenant is data, not configuration: create the org in Clerk, insert its document in `platform.tenants`, zero env changes, zero redeploys.

## How to run

Requirements: Node >= 22, pnpm, Tilt, a local Kubernetes cluster (OrbStack/Docker Desktop).

```bash
pnpm install
pnpm dev:tilt
```

`tilt up` deploys MongoDB (reachable on `mongodb://localhost:27017` via Tilt port-forward), runs the seed and serves the API on port 3000 and the web app on port 3001, both locally with live reload. Open `http://localhost:3001`, sign in with a Clerk test user, pick its organization and the dashboard shows the raw API responses: the global user document (`platform.users`) and the tenant's loan applications, created and listed with zero tenant filters. The form posts to the API with the Clerk token.

Useful manual probes:

```bash
curl localhost:3000/loan-applications                         # 401 UNAUTHENTICATED
curl -H "Authorization: Bearer $TOKEN" localhost:3000/loan-applications
curl -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: other" localhost:3000/loan-applications   # 403 TENANT_MISMATCH
curl localhost:3000/tenants                                   # public registry (PoC admin surface)
```

To run pieces without Tilt: `pnpm dev` (API), `pnpm web-dev` (web). Re-seed anytime with `pnpm seed`.

## Tests

```bash
pnpm test        # unit suites (no Mongo needed)
pnpm test:e2e    # needs the Tilt Mongo up; uses .env.test (platform_test / test_tenant_*)
```

The e2e suite signs real RS256 JWTs with a throwaway key pair generated per run and hands the public key to the API via `CLERK_JWT_KEY`, so signature verification is real (nothing is mocked at the verification point). It covers: 401 for missing/tampered/expired tokens and tokens without `org_id`; 403 for unregistered orgs; 403 when a header or query param declares a tenant different from the claim (claim is the only authority); per-tenant listing; cross-tenant fetch by id returning 404 (not 403); documents stored without any tenant field; 40 interleaved parallel requests with zero cross-tenant leakage; and boot failing with a clear Zod error on incomplete env.

## What the PoC proved

1. Structural isolation works: `loan-applications` queries have zero tenant filters and still only see their tenant's data, because the handle returned by `useDb` is already scoped.
2. The tenant can be derived exclusively from a cryptographically verified claim: signature, expiry and issuer checked before `org_id` is read, and client-declared tenants never override it (403 on mismatch).
3. Concurrency is safe as long as the handle is resolved per request and never stored in a singleton; 40 interleaved requests showed no contamination.
4. Multi-environment works with the same code: `.env.local` vs `.env.test` switch databases and Zod kills the boot fast on incomplete env.

Known limitations of the bridge model: migrations and index builds must run N times (once per tenant database); cross-tenant aggregation requires fan-out over databases (read-time fan-out driven by the platform `tenants` registry, write-time pre-aggregated counters, or a separate analytics plane); the noisy-neighbor problem remains because the cluster is shared; connection/model caches grow with the number of tenants.

Out of scope: CSFLE, message bus, CI/CD, remote deploy, enterprise SSO/SAML, Clerk webhooks (users are seeded, not invited).

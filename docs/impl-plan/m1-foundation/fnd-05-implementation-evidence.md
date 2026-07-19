# FND-05 Implementation Evidence

> **Work package:** `FND-05`
> **Status:** Completed
> **Evidence date:** 19 July 2026
> **Last updated:** 19 July 2026
> **Toolchain:** Node.js 24.18.0, pnpm 11.14.0
> **Plan:** [FND-05 package plan](./fnd-05-database-and-migration-foundation-plan.md)

---

## 1. Implemented Database Foundation

`FND-05` established the first PostgreSQL and Drizzle foundation package:

- `packages/database`: Drizzle schema modules, inferred table row types,
  reviewed migration source, generated SQL migration artifact, role names,
  tenant-context helpers, idempotency helpers, change-feed cursors, outbox
  dispatch helpers, and database readiness metadata.
- `packages/database/migrations/0001_fnd_05_database_foundation.sql`: first
  reviewed SQL migration artifact for schema, roles, tenant context, tenant
  tables, RLS policies, audit events, idempotency results, change events,
  outbox events, and migration bookkeeping.
- `apps/api`: `/ready` now reports database foundation metadata and outbox
  foundation status without claiming a live database connection.
- `apps/worker`: lifecycle logs now include the accepted database migration
  version and FND-05 outbox policy marker without running queue dispatch.
- Root generated-output drift now includes database migration generation.

## 2. Database Scope

The first database surface intentionally implements foundation primitives only:

- PostgreSQL role names for migration, application, worker, and read-only
  operations usage.
- Tenant context settings for active household, actor, and actor role.
- RLS-enabled tenant tables for households, children, audit events,
  idempotency results, change events, and outbox events.
- Migration bookkeeping through `littlearc.schema_migrations`.
- Helpers for idempotency replay matching, opaque change-feed cursors, and
  outbox dispatch state.

Runtime database connections, real migration execution against Railway, Better
Auth storage, product repositories, sync execution, and real queue dispatch
remain later work.

## 3. Validation Results

All commands below ran from the repository root with Node.js 24.18.0 and pnpm
11.14.0.

| Validation | Result |
| --- | --- |
| `pnpm install --frozen-lockfile=false` | Pass; lockfile updated for FND-05 Drizzle tooling |
| `pnpm --filter @littlearc/database generate` | Pass; SQL migration artifact generated |
| `pnpm --filter @littlearc/database typecheck` | Pass |
| `pnpm --filter @littlearc/database test` | Pass; 10 database schema/migration/helper tests |
| `pnpm --filter @littlearc/database build` | Pass |
| `pnpm check:generated` | Pass; contracts and database migration generators checked |
| `pnpm --filter @littlearc/api test` | Pass; 4 Fastify injection tests |
| `pnpm --filter @littlearc/api typecheck` | Pass |
| `pnpm --filter @littlearc/worker test` | Pass; 2 worker lifecycle tests |
| `pnpm --filter @littlearc/worker typecheck` | Pass |
| `pnpm check:workspace` | Pass; 23 tooling tests, boundaries, and environment templates |
| `pnpm check:format` | Pass; Biome and Markdown |
| `pnpm check:docs` | Pass |
| `pnpm typecheck` | Pass; tooling plus package/application typechecks |
| `git diff --check` | Pass |
| `pnpm build` | Pass; domain, contracts, database, API, worker, mobile export, and ops-web build |
| `pnpm test` | Pass; 55 total tests across tooling, domain, database, worker, API, and contracts |
| `pnpm validate` | Pass |
| `./tooling/validate-clean-checkout.sh` | Pass in a 212-file source-only snapshot |

Clean-checkout install still prints the known non-fatal `sharp@0.34.5`
source-build message, then exits successfully and completes validation.

## 4. Evidence Boundaries

Completed in this package:

- Database package compiles and builds declarations.
- Drizzle schema files use one table per file and inferred row types.
- Reviewed SQL migration creates the FND-05 foundation database surface.
- RLS policy presence, role declarations, tenant context, idempotency, change
  cursor, outbox, and generated migration drift are test-covered.
- API and worker shells consume database foundation metadata without opening
  database connections.
- Root generated-output drift covers the database migration artifact.

Not claimed by this package:

- Runtime PostgreSQL connectivity, hosted database provisioning, or release
  migration execution.
- Container-backed PostgreSQL RLS integration tests.
- Authentication, household membership, consent workflows, or sessions.
- Product repositories, CRUD routes, sync execution, conflict resolution, or
  staff operations.
- Real `pg-boss` dispatch, retries, dead-letter processing, or job handlers.
- Mobile SQLCipher repositories, offline outbox behavior, or conflict UI.
- Any use of real child, participant, household, or medical document data.

## 5. Completion Decision

**Decision: COMPLETE.** The Drizzle schema foundation, reviewed SQL migration,
tenant/RLS policy source, audit/idempotency/outbox/change primitives, API and
worker metadata integration, generated-output drift guard, focused tests, root
validation, and clean-checkout proof are implemented and accepted for the local
synthetic M1 environment.

`FND-06` is the next ready package: Railway environment skeleton.

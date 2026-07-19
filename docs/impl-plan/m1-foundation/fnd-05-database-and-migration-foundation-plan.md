# FND-05 Database and Migration Foundation

> **Status:** Completed
> **Owner:** Engineering
> **Started date:** 19 July 2026
> **Last updated:** 19 July 2026
> **Work package:** `FND-05`
> **Depends on:** `FND-01`, `FND-02`, `FND-03`, `FND-04`
> **Acceptance evidence:** [FND-05 implementation evidence](./fnd-05-implementation-evidence.md)
> **Inputs:** [Implementation roadmap](../roadmap.md),
> [architecture](../../core/littlearc-architecture-and-tech-stack.md),
> [environment catalog](../../reference/environment-variable-catalog.md), and
> [delivery dashboard](../../IMPLEMENTATION_STATUS.md)

---

## Status Summary

| Module | Status | Evidence |
| --- | --- | --- |
| Database package scaffold | Completed | See implementation evidence |
| Drizzle schema conventions | Completed | See implementation evidence |
| SQL migration and role conventions | Completed | See implementation evidence |
| Tenant context and RLS harness | Completed | See implementation evidence |
| Audit/idempotency/outbox/change primitives | Completed | See implementation evidence |
| API and worker compile integration | Completed | See implementation evidence |
| Documentation and evidence | Completed | See implementation evidence |

## 1. Goal and Outcome

`FND-05` establishes the first PostgreSQL and Drizzle foundation for the
server-authoritative LittleArc data path. It must make the database package
compile, make migrations reviewable, and prove the tenant-boundary primitives
without implementing product CRUD workflows.

The observable outcome is:

- `packages/database` exports Drizzle schema modules, inferred row types,
  migration metadata, role names, tenant-context helpers, and SQL policy
  fragments.
- A first reviewed SQL migration creates schemas, roles, tenant context
  function, base tenant tables, RLS policies, audit events, idempotency results,
  change events, outbox events, and migration bookkeeping.
- Tests verify schema export shape, SQL migration invariants, RLS policy
  presence, tenant context behavior, idempotency result keying, outbox dispatch
  state, and change-feed ordering helpers.
- API and worker shells can compile against database readiness metadata without
  opening database connections or claiming production connectivity.
- Root validation treats database migrations as generated/reviewed artifacts
  and catches drift.

## 2. Scope Boundaries

### Included

- `@littlearc/database` package manifest, TypeScript configs, public exports,
  and focused tests.
- Drizzle PostgreSQL table definitions using one table per file and inferred
  select/insert types.
- Tenant-owned base tables for household and child identity metadata needed by
  later auth and sync packages.
- Append-only audit event table shape with minimized queryable details.
- Idempotency result table keyed by active household, actor, and idempotency
  key.
- Change-event table for server-authoritative sync sequencing.
- Transactional outbox table for future `pg-boss` dispatch.
- SQL role, schema, extension, RLS, policy, and release-migration conventions.
- Test helpers that inspect committed SQL and typed policy helpers.
- Documentation updates and validation evidence.

### Excluded

- Connecting to a real Railway database or committing any `DATABASE_URL`.
- Running migrations automatically from API, worker, or application startup.
- Better Auth storage schema, real sessions, membership assignment, or login
  routes.
- Product CRUD routes, repositories, records, files, reminders, tasks,
  entitlements, export/deletion workflows, or staff actions.
- Real `pg-boss` job dispatch, retries, dead-letter handling, or worker
  payload processing.
- Mobile SQLCipher schema, offline repository implementation, local mutation
  queue, or conflict UI.
- Importing quarantined prototype mobile screens, components, theme, or design
  token source.
- Real child, participant, household, or medical document data.

## 3. Dependencies and Decisions

`FND-01` supplies workspace scripts, exact dependency governance, and generated
artifact checks. `FND-02` supplies CI entrypoints. `FND-03` supplies API and
worker shells. `FND-04` supplies UUIDv7, timestamp, revision, cursor,
idempotency, audit, and contract primitives.

Implementation decisions:

- Use Drizzle for schema source and reviewed SQL migrations.
- Keep table definitions one table per file; export base tables first,
  dependents next, relations last when relations are introduced.
- Commit reviewed SQL migrations with schema changes; use `db:push` only for
  disposable local iteration.
- Migrations are explicit release steps, never implicit application boot work.
- Keep runtime database connections optional in M1 until environment
  provisioning arrives.
- Use PostgreSQL RLS policy SQL as the tenant-boundary source of truth and
  test the policy text until container-backed integration tests are available.

## 4. Data, Security, and Privacy

This package may define schemas and synthetic test values only. It must not
introduce credentials, provider accounts, child data, participant data, household
data, medical documents, or decrypted payload examples.

Security and privacy controls for this package:

- Tenant tables carry `household_id` and have RLS enabled.
- The active household context is read from PostgreSQL session settings and
  must be established inside transaction scope by later repositories.
- Application, migration, worker, and read-only operational roles are named
  separately.
- Audit details are minimized and represented as JSON metadata rather than
  decrypted content.
- Idempotency records include the stored response code/body only for replayable
  mutation results and expire by policy.
- Outbox payloads are restricted to opaque IDs and operation metadata.

## 5. Migration Conventions

- Migration SQL lives under `packages/database/migrations/` and is committed.
- The first migration is the reviewed foundation baseline.
- Generated migration review must check for unintended drops, missing defaults
  on required columns, unsafe indexes, missing RLS, and role privilege leakage.
- Application code may expose migration metadata and SQL paths, but API and
  worker startup must not run migrations.
- Staging/production migration execution belongs to later release runbooks.

## 6. Verification

Focused checks:

- `pnpm --filter @littlearc/database typecheck`
- `pnpm --filter @littlearc/database test`
- `pnpm --filter @littlearc/database build`
- `pnpm check:generated`
- `pnpm --filter @littlearc/api test`
- `pnpm --filter @littlearc/api typecheck`
- `pnpm --filter @littlearc/worker test`
- `pnpm --filter @littlearc/worker typecheck`

Broad checks:

- `pnpm check:workspace`
- `pnpm check:format`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm validate`
- `./tooling/validate-clean-checkout.sh`

## 7. Delivery Slices

1. Write and validate this package brief; mark `FND-05` in progress.
2. Implement `@littlearc/database` package scaffolding and Drizzle dependency
   wiring.
3. Add one-table-per-file schema modules and inferred row types.
4. Add reviewed foundation SQL migration, role declarations, RLS policies, and
   migration metadata.
5. Add focused tests for schema exports, SQL invariants, tenant context,
   idempotency, outbox, and change-event helper behavior.
6. Integrate API and worker shells with database readiness metadata while
   preserving deferred connectivity.
7. Register migration artifact checks.
8. Run focused validation, then root validation.
9. Record implementation evidence and update the delivery dashboard.

## 8. Definition of Done

`FND-05` is complete when:

- `packages/database` compiles, builds declarations, and is exported as a
  workspace package.
- Drizzle schema files and inferred types exist for the FND-05 foundation
  tables.
- A reviewed SQL migration creates the database foundation, role names, tenant
  context, RLS policies, audit, idempotency, change-event, and outbox tables.
- Tests verify the committed migration and core helper behavior.
- API and worker shells compile against the database package without direct
  database startup side effects.
- Generated-output drift checks cover the reviewed migration artifact.
- Evidence documents exact checks run and deferred gates.
- The delivery dashboard links the accepted plan and evidence.

## 9. Risks and Residual Obligations

| Risk | Control | Residual obligation |
| --- | --- | --- |
| SQL policy tests miss runtime behavior | Test committed SQL invariants now | Add container-backed PostgreSQL integration tests when local service orchestration is accepted |
| Role definitions drift from hosted database setup | Centralize role names and migration metadata | `FND-06` provisions matching Railway roles and secrets |
| Database foundation implies auth is complete | Keep membership/session behavior out of scope | `OFF-01` and `OFF-02` implement real auth, household membership, and consent flows |
| Outbox table exists without dispatcher | Store dispatch metadata only | Worker dispatch and retry behavior arrive in later queue/job packages |
| Idempotency table stores sensitive responses | Limit schema to replay metadata and response body placeholder | Route-specific handlers must scrub and bound stored responses |

# Database Migrations

> **Status:** Active
> **Last updated:** 2026-07-19
> **Owner:** Engineering
> **Applies to:** PostgreSQL schema and release migrations
> **Decision:** [ADR-0005](../../adr/0005-postgresql-rls-migrations-and-pg-boss.md)

## Authoritative Sources

- `packages/database/src/schema/` owns the typed schema.
- `packages/database/migrations/` contains reviewed ordered SQL artifacts.
- `packages/database/src/migrations/metadata.ts` owns accepted migration metadata.
- `packages/database/migrations/README.md` records package-specific commands and
  invariants.

## Change Procedure

1. Change the typed schema and related tenant/RLS or primitive tests.
2. Generate the candidate migration with the package generation command.
3. Review SQL for roles, grants, RLS, locks, backfills, indexes, transaction
   behavior, and compatibility with the currently deployed application.
4. Run package tests and generated-output drift checks.
5. Apply forward to a fresh PostgreSQL instance, then to staging through the
   explicit release step before deploying dependent application code.
6. Record migration version, source commit, environment, result, and any restore
   or follow-up obligation without recording connection details.

## Prohibited Shortcuts

- Do not use `db:push` against shared staging or future production.
- Do not edit an applied migration; add a new ordered migration.
- Do not use an in-memory substitute to claim PostgreSQL/RLS/transaction proof.
- Do not assume application authorization replaces tenant context and RLS.
- Do not promise automatic down migrations. For destructive changes, define a
  staged compatibility and restore plan before release.

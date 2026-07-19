# ADR-0005: PostgreSQL, RLS, Migrations, and pg-boss

> **Status:** Accepted
> **Date:** 2026-07-19
> **Owner:** Engineering
> **Review date:** 2026-10-19
> **Supersedes:** None
> **Superseded by:** None
> **Related documents:** [FND-05 plan](../impl-plan/m1-foundation/fnd-05-database-and-migration-foundation-plan.md), [FND-05 evidence](../impl-plan/m1-foundation/fnd-05-implementation-evidence.md), [migration note](../reference/engineering/database-migrations.md)

---

## Context

Household isolation, auditability, idempotency, outbox delivery, change feeds,
and background jobs share transactional requirements. The system needs reviewed
schema evolution and database-enforced tenant defense.

## Decision

Use PostgreSQL as the server data store, Drizzle as schema/query tooling,
explicit forward SQL migrations, transaction-local tenant context, and RLS as a
defense-in-depth boundary. Use `pg-boss` on the same PostgreSQL service for the
initial job queue; do not add Redis. Keep separate application, worker,
migration, and read-only operational roles.

## Alternatives Considered

- Application-only tenant filters: rejected because one missed predicate could
  become a cross-household disclosure.
- Automatic schema push in shared environments: rejected because it lacks a
  stable reviewed release artifact.
- Redis-backed queues: rejected because current throughput does not justify
  another stateful service or cross-store coordination.
- In-memory database tests: rejected for RLS and transaction semantics.

## Consequences

Business writes, outbox rows, and jobs can share PostgreSQL transactions, and
RLS adds a strong backstop. Queue load competes with application load and must be
measured. Migrations require explicit ownership, ordering, and rollback/restore
planning; `db:push` is not a release command.

## Validation

Generated migration drift, schema/primitive tests, and the successful staging
forward migration verify the implemented foundation. Container-backed
cross-household RLS integration and runtime `pg-boss` behavior remain explicit
Gate 1/later-package evidence; this ADR does not convert policy-source tests into
those passes.

## Review Triggers

Review by 2026-10-19, or earlier if queue latency/load threatens database SLOs,
multi-region requirements appear, migration rollback becomes unsafe, or tenant
isolation testing finds a policy gap.

# Architecture Decision Records

> **Status:** Active index
> **Last updated:** 2026-07-24
> **Owner:** Engineering

Use ADRs for important decisions that affect system structure, quality
attributes, operational policy, security posture, data handling, or choices that
are difficult to reverse.

Do not use ADRs as a changelog, task tracker, or replacement for implementation
evidence. Link accepted ADRs from the relevant core document, implementation
plan, or status dashboard.

Create new ADRs from [the ADR template](../templates/adr-template.md) and number
them sequentially. Accepted ADRs are historical records: replace a changed
decision with a new ADR and link both records through `Supersedes` and
`Superseded by` instead of rewriting the old decision.

## Decision Index

| ADR | Status | Decision | Accepted | Review |
| --- | --- | --- | --- | --- |
| [ADR-0001](./0001-workspace-and-repository-boundaries.md) | Accepted | pnpm/Turborepo workspace with enforced application/package boundaries | 2026-07-19 | 2027-01-19 |
| [ADR-0002](./0002-expo-native-development-and-spike-disposition.md) | Accepted | Expo custom development clients, local native builds, and retained-spike disposition | 2026-07-19 | 2026-10-19 |
| [ADR-0003](./0003-rest-openapi-contract-boundary.md) | Accepted | Versioned REST with Zod-generated OpenAPI and clients | 2026-07-19 | 2027-01-19 |
| [ADR-0004](./0004-fastify-drizzle-modular-monolith.md) | Accepted | Fastify/Drizzle modular monolith with explicit deployable boundaries | 2026-07-19 | 2027-01-19 |
| [ADR-0005](./0005-postgresql-rls-migrations-and-pg-boss.md) | Accepted | PostgreSQL, RLS, reviewed migrations, and `pg-boss` without Redis | 2026-07-19 | 2026-10-19 |
| [ADR-0006](./0006-railway-singapore-environment-topology.md) | Accepted | Railway Singapore staging topology; production deferred | 2026-07-19 | 2026-10-19 |
| [ADR-0007](./0007-privacy-safe-observability-boundary.md) | Accepted | Allowlisted and scrubbed observability wrapper boundary | 2026-07-19 | 2026-10-19 |
| [ADR-0008](./0008-semantic-design-system-boundary.md) | Accepted | Platform-neutral semantic tokens and app-owned theme mapping | 2026-07-19 | 2027-01-19 |
| [ADR-0009](./0009-consumer-authentication-and-session-boundary.md) | Accepted | Self-hosted passwordless consumer auth with PostgreSQL sessions and SecureStore | 2026-07-20 | 2026-10-20 |
| [ADR-0010](./0010-household-membership-encryption-and-consent-boundary.md) | Accepted | Membership actors, atomic consented onboarding, tenant RLS, and envelope encryption | 2026-07-22 | 2026-10-22 |
| [ADR-0011](./0011-local-key-custody-app-lock-and-device-enrollment.md) | Accepted | Device-bound local keys, app lock, invalidation recovery, wipe, and authority-neutral enrollment | 2026-07-22 | 2026-10-22 |
| [ADR-0012](./0012-server-authoritative-synchronization-and-conflict-boundary.md) | Accepted | Signed cursors, reset staging, durable mutations, and explicit critical conflicts | 2026-07-22 | 2026-10-22 |
| [ADR-0013](./0013-emergency-card-aggregate-and-standard-access-boundary.md) | Accepted | Dedicated immutable emergency-card versions with standard post-unlock access | 2026-07-22 | 2026-10-22 |
| [ADR-0014](./0014-record-aggregate-provenance-and-generated-timeline-boundary.md) | Accepted | Generic immutable records with trusted provenance and source-linked Timeline projections | 2026-07-24 | 2026-10-24 |

Architecture candidates not represented here have not yet been implemented.
Create their ADRs with the owning work package rather than treating the core
architecture backlog as accepted implementation evidence.

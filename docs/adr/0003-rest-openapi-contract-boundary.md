# ADR-0003: REST and OpenAPI Contract Boundary

> **Status:** Accepted
> **Date:** 2026-07-19
> **Owner:** Engineering
> **Review date:** 2027-01-19
> **Supersedes:** None
> **Superseded by:** None
> **Related documents:** [FND-04 plan](../impl-plan/m1-foundation/fnd-04-contracts-and-domain-kernel-plan.md), [FND-04 evidence](../impl-plan/m1-foundation/fnd-04-implementation-evidence.md)

---

## Context

Mobile and staff clients need a stable, reviewable boundary that does not expose
database models or server implementation. The API must support generated clients,
versioning, idempotency, and standard error responses.

## Decision

Use versioned REST endpoints and generate OpenAPI from the Zod contract source.
Generate mobile and staff clients from the accepted artifact, keep generated
output reproducible, use Problem Details for errors, and guard breaking contract
changes in validation. Contracts remain independent of database models.

## Alternatives Considered

- GraphQL: rejected because its runtime/schema complexity is unnecessary for the
  initial bounded workflows and offline synchronization model.
- tRPC: rejected because it couples clients to TypeScript server implementation
  and is less suitable as a durable cross-client contract.
- Handwritten OpenAPI or clients: rejected because parallel sources drift.

## Consequences

The API gains explicit versioning and portable documentation, but schema changes
must flow through generation and compatibility review. Endpoint composition can
be less flexible than GraphQL, which is acceptable for the initial product.

## Validation

Contract generation, drift checks, breaking-change policy, generated-client
compilation, and API contract tests run through `pnpm test:contract`,
`pnpm check:generated`, and root validation.

## Review Triggers

Review by 2027-01-19, or earlier if a non-TypeScript client, public API,
high-churn aggregation requirement, or incompatible versioning need appears.

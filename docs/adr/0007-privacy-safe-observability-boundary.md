# ADR-0007: Privacy-Safe Observability Boundary

> **Status:** Accepted
> **Date:** 2026-07-19
> **Owner:** Engineering
> **Review date:** 2026-10-19
> **Supersedes:** None
> **Superseded by:** None
> **Related documents:** [FND-07 plan](../impl-plan/m1-foundation/fnd-07-observability-and-privacy-guards-plan.md), [FND-07 evidence](../impl-plan/m1-foundation/fnd-07-implementation-evidence.md), [data-classification note](../reference/engineering/data-classification.md)

---

## Context

Logs, analytics, flags, and error reports can accidentally disclose child,
medical, identity, credential, or infrastructure data. Applications still need
stable operational signals and provider portability.

## Decision

Route observability through `@littlearc/observability`: stable safe log codes,
compile-time analytics/flag allowlists, false-default kill switches, positive
Sentry-compatible scrubbing, and seeded leakage canaries. Provider delivery is
disabled until configured and approved. If PostHog or Sentry is enabled, use EU
projects and the same wrapper boundary; application code cannot send arbitrary
payloads directly.

## Alternatives Considered

- Direct provider SDK calls: rejected because payload policy would fragment.
- Denylist-only redaction: rejected because unknown fields and nested values can
  leak; allowed schemas plus positive scrubbing are safer.
- No observability: rejected because incident response and release diagnosis
  need bounded evidence.

## Consequences

Signals are intentionally lower-cardinality and less rich than raw application
state. New events/fields require allowlist review. Provider approval, DPA,
retention, and processor inventory remain pre-real-data obligations.

## Validation

Unit tests, safe logger assertions, compile-time event/flag constraints, canary
scans, application adoption tests, and root validation enforce the boundary.

## Review Triggers

Review by 2026-10-19, or earlier before any provider is enabled, a new data class
is emitted, an incident reveals leakage, or legal/privacy requirements change.

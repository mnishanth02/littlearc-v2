# ADR-0008: Semantic Design-System Boundary

> **Status:** Accepted
> **Date:** 2026-07-19
> **Owner:** Engineering
> **Review date:** 2027-01-19
> **Supersedes:** None
> **Superseded by:** None
> **Related documents:** [design system](../core/design-system.md), [FND-08 plan](../impl-plan/m1-foundation/fnd-08-design-system-prototype-reconciliation-plan.md), [FND-08 evidence](../impl-plan/m1-foundation/fnd-08-implementation-evidence.md)

---

## Context

Mobile and staff experiences need consistent accessibility and trust semantics
without turning discarded prototypes or platform styling objects into shared
architecture.

## Decision

Keep `@littlearc/design-tokens` platform-neutral and expose semantic color,
typography, spacing, radius, touch, breakpoint, and motion contracts. Map those
roles to light, dark, and high-contrast Unistyles 3 themes in the mobile app.
Accept only small primitives with active consumers; feature-owned domain
components are built with their first production slice. Product UI cannot bypass
the boundary with literal colors or legacy styling APIs.

## Alternatives Considered

- Share React Native style objects from the token package: rejected because it
  would couple tokens to one renderer.
- Preserve all prototype components: rejected because mock contracts would
  become accidental production APIs.
- Raw palette access in screens: rejected because theme, contrast, and semantic
  meaning would drift.

## Consequences

Theme changes and accessibility modes remain centralized, but every new semantic
role must be mapped and tested across themes. The initial primitive set is small
by design; domain components require deliberate feature work.

## Validation

Token parity/contrast tests, semantic-source policy, dynamic-type/touch-target
constraints, mobile typecheck, Android/iOS exports, and release-bundle gallery
checks validate the accepted boundary.

## Review Triggers

Review by 2027-01-19, or earlier when the staff web adopts shared tokens, a new
platform is added, accessibility evidence exposes a token gap, or Unistyles is
replaced/upgraded incompatibly.

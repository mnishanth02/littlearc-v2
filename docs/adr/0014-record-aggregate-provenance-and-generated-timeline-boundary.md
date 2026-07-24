# ADR-0014: Record Aggregate, Provenance, and Generated Timeline Boundary

> **Status:** Accepted
> **Date:** 2026-07-24
> **Owner:** Engineering
> **Last reviewed:** 2026-07-24 for VLT-02 category payloads
> **Review date:** 2026-10-24
> **Supersedes:** None
> **Superseded by:** None
> **Related documents:** [VLT-01 plan](../impl-plan/m3-vault-wedge/vlt-01-record-model-versions-provenance-and-timeline-projection-plan.md), [VLT-02 plan](../impl-plan/m3-vault-wedge/vlt-02-manual-record-creation-plan.md), [VLT-02 evidence](../impl-plan/m3-vault-wedge/vlt-02-implementation-evidence.md), [architecture](../core/littlearc-architecture-and-tech-stack.md), [backend data model](../core/backend-data-model-and-database-schema.md), and [ADR-0012](./0012-server-authoritative-synchronization-and-conflict-boundary.md)

---

## Context

LittleArc needs a common parent-owned record foundation before manual forms,
capture, OCR, search, reminders, and the production Timeline are added. The
foundation must preserve corrections and provenance, keep suggestions from
becoming facts, synchronize offline without creating another authority, and
avoid stale generated Timeline facts.

The product sources list caregiver entry alongside source provenance, while the
accepted domain values describe acquisition source. Provider/government labels
also exist before an issuer registry or trusted adapter. Confirmed records are
required to produce a Timeline projection even though their clinical event date
may be unknown.

## Decision

- Use one generic `records` aggregate with immutable `record_versions`.
  Category packages extend a bounded, versioned content union instead of adding
  parallel aggregate tables.
- Keep queryable category, source class, confirmation state, event time,
  revision, and lifecycle metadata on the aggregate. Encrypt title,
  provider/facility, notes, category content, provenance detail, suggestions,
  source spans, and Timeline summaries with the household envelope.
- Treat acquisition source and actor context separately. The source values are
  `manual`, `imported`, `ocr_assisted`, `ai_assisted`, `provider_issued`, and
  `government_imported`; caregiver entry is represented by the membership
  actor.
- Reserve provider/government provenance for future trusted adapters. A
  consumer client cannot self-assert either label or a user-visible verified
  claim.
- Store suggestions separately from immutable versions. Only explicit
  confirmation appends confirmed content and generates Timeline authority.
- Correct confirmed records by appending a version and advancing the current
  pointer. Provider artifacts are never overwritten; annotations/corrections
  retain both source and actor context.
- Treat generated Timeline rows as replaceable projections linked to record and
  source version. Keep one active generated projection per current confirmed
  record; correction deactivates the prior row, while archive/delete
  deactivates or tombstones it.
- When a confirmed record has no clinical event date, order its Timeline
  projection by server confirmation time and encrypt an explicit
  `confirmedAtFallback` label. Never present that fallback as a clinical date.
- Derive record access scope on the server from category. Identity records use
  the identity-document capability; other MVP records use selected-health
  access. Stored access policy cannot grant authority.
- Reuse ADR-0012 synchronization, critical-conflict, reset, tombstone, locked
  SQLCipher, and sign-out-risk rules for records and Timeline projections.
- Delete immediately writes record/Timeline tombstones and one minimized purge
  request. Hard-purge timing and execution remain with the approved deletion
  workflow.

## Alternatives Considered

- Category-specific record tables: rejected because they would duplicate
  versions, provenance, authorization, sync, and deletion behavior.
- Mutable current JSON only: rejected because correction history and source
  context would be lost.
- Store suggestions inside the confirmed payload: rejected because automated
  output could be mistaken for accepted fact.
- Treat caregiver entry as a source enum: rejected because the actor already
  expresses who entered the record and acquisition source answers a different
  question.
- Let clients select provider/government provenance: rejected because the
  current system has no trusted issuer proof.
- Update one Timeline row in place: rejected because it weakens version/source
  traceability.
- Require a clinical event date for every record: rejected because document
  date may be genuinely unknown; an explicit confirmation-time fallback is
  safer than a fabricated date.
- Execute hard purge in VLT-01: rejected because retention and restartable
  deletion policy are not approved.

## Consequences

Later record categories must add reviewed discriminated payload schemas and
cannot bypass the common aggregate. A correction creates an additional
immutable version and generated projection row, increasing storage modestly but
preserving source history. Snapshot synchronization carries current projections
while version history is queried and cached separately.

Provider/government imports remain representable but unavailable to ordinary
consumer mutations. Search and reminder packages must use confirmed current
versions only. The Timeline UI must explain confirmation-time fallback and
cannot infer medical chronology from it.

## Validation

Domain and contract tests cover payload bounds, access scope, provenance
authorization, transitions, Timeline date authority, and typed sync variants.
PostgreSQL integration covers RLS/BOLA, immutable versions, atomic
create/correction/Timeline evidence, exact replay, stale conflict, suggestion
separation, tombstones, purge request, rollback, and plaintext canaries.
SQLCipher tests cover V4 migration, optimistic changes, reset, conflict,
tombstone, history cache, and wipe. The development-only native flow exercises
the fixed synthetic lifecycle on physical Android and iOS Simulator within the
VLT-01 evidence boundary.

## VLT-02 Triggered Review

VLT-02 exercised the early review trigger by adding document, vaccination,
doctor-visit, and prescription discriminated payloads. The review retained
this decision unchanged:

- every payload remains inside the generic record aggregate and versioned
  content union;
- manual confirmation is the only authority added by VLT-02;
- drafts remain separate local form artifacts without provenance, versions, or
  Timeline authority;
- corrections append immutable versions and replace the active generated
  Timeline projection; and
- synchronization, access scope, conflict, tombstone, and purge-request
  behavior continue through ADR-0012 and VLT-01.

The next scheduled review date remains 2026-10-24.

## Review Triggers

Review by 2026-10-24, or earlier when a second category payload is added,
provider/government issuer verification is implemented, field-level merge is
proposed, arbitrary record sharing is accepted, Timeline date semantics change,
version-history synchronization becomes eager, or hard-purge policy is
approved.

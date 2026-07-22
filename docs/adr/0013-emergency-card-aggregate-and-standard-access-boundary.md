# ADR-0013: Emergency-Card Aggregate and Standard-Access Boundary

> **Status:** Accepted
> **Date:** 2026-07-22
> **Owner:** Engineering
> **Review date:** 2026-10-22
> **Supersedes:** None
> **Superseded by:** None
> **Related documents:** [OFF-05 plan](../impl-plan/m2-offline-trust/off-05-emergency-card-vertical-slice-plan.md), [OFF-05 evidence](../impl-plan/m2-offline-trust/off-05-implementation-evidence.md), [backend data model](../core/backend-data-model-and-database-schema.md), [ADR-0011](./0011-local-key-custody-app-lock-and-device-enrollment.md), and [ADR-0012](./0012-server-authoritative-synchronization-and-conflict-boundary.md)

---

## Context

The walking skeleton needs a complete emergency-card lifecycle that remains
usable offline without weakening accepted device-key custody. The target data
model left open whether emergency data should share the future generic record
aggregate or use dedicated immutable versions. The mobile-flow specification
also describes quick access, but its OS surface, exposed fields, screenshot
posture, timeout, and key-separation model remain unresolved under `OD-03`.

Blank clinical input is unsafe because it cannot distinguish unknown from a
confirmed absence. Concurrent edits are also critical: silently merging or
overwriting a stale card could hide a materially different confirmed version.

## Decision

- Use a dedicated `emergency_cards` aggregate with one active card per child
  and immutable encrypted `emergency_card_versions`. The aggregate stores the
  current-version pointer, revision, actor metadata, lifecycle, and access mode;
  each accepted edit appends one version in the same transaction.
- Store the complete confirmed card as an `EncryptedEnvelopeV1` bound to the
  household, card, object type, and schema version. Keep clinical facts,
  preferred name, date of birth, and contacts out of audit, change, outbox,
  idempotency, logs, and analytics evidence.
- Represent blood group, allergies, critical notes, urgent medication, and
  pediatrician through discriminated states. Preserve `notProvided`,
  `noneConfirmed` where applicable, and confirmed values; require at least one
  valid guardian contact.
- Ship `standard` access only. The card renders from SQLCipher after the
  accepted app-unlock/key boundary. Do not add a weaker key, plaintext cache,
  widget, shortcut, notification payload, custom PIN, or locked surface until
  `OD-03` is approved in a replacement or extending ADR.
- Extend the OFF-04 mutation, signed-cursor, snapshot, reset, tombstone,
  idempotency, and conflict protocols with an `emergencyCard` entity. Do not
  create a parallel synchronization channel.
- Treat the whole emergency card as critical. A stale base revision preserves
  the local proposal and the current authoritative projection for explicit
  review; it never performs an automatic field merge or last-write-wins.
- Authorize reads with `viewEmergencyCard`. Authorize edits for an owner or a
  caregiver holding both `viewEmergencyCard` and `editConfirmedRecords`.
  Tenant, membership actor, role, and capabilities remain server derived.
- Expose deliberate dialer intents only. The user must place any call in the
  platform dialer; LittleArc does not initiate calls or mutate contacts.

## Alternatives Considered

- Reuse the future generic record/version aggregate: rejected because it would
  force an unimplemented M3 abstraction into the M2 walking skeleton and blur
  the pinned offline/emergency lifecycle.
- Embed emergency fields in the child profile: rejected because confirmation,
  immutable history, conflict review, and access policy have distinct
  lifecycles.
- Implement locked quick access with the SQLCipher key: rejected because the
  accepted key requires app authentication and the exposure policy is open.
- Keep a reduced plaintext emergency cache: rejected because it weakens local
  data protection and creates another source of truth.
- Merge non-overlapping stale fields automatically: rejected for the first
  slice because the complete card is clinically and operationally critical.

## Consequences

Emergency information now has a narrow, production-shaped aggregate and can
reuse existing encryption, RLS, audit, change, outbox, and synchronization
primitives. It adds a dedicated schema/migration, an entity codec in the shared
sync protocol, and SQLCipher schema V3.

The standard-access card meets the post-unlock offline requirement but does not
resolve quick access. Gate 2 also remains open for OFF-06, both-platform
onboarding, real two-device conflict evidence, low-end Android coverage, and
the other named matrix obligations.

## Validation

Domain, contract, migration, API, repository, and presentation tests cover
explicit states, capability policy, immutable versions, idempotency, shared
sync dispatch, conflict preservation, dialer URLs, and local schema V3. A
disposable Aiven PostgreSQL run covers encrypted create/update, exact replay,
changed replay, stale conflict, RLS/BOLA, least privilege, immutability, and
plaintext canaries.

The bounded Pixel 8 run covers SQLCipher creation, HTTP/PostgreSQL sync,
airplane-mode process restart, cached rendering, the platform dialer, a
server-simulated stale writer, immutable evidence counts, 200% text, high
contrast, TalkBack attachment/semantics, app-log canaries, and verified wipe.

## Review Triggers

Review by 2026-10-22, or earlier when `OD-03` is approved, a locked OS entry
point or separate key is proposed, sharing/export enters committed scope,
field-level merge is considered, the capability model changes, deletion or
retention policy is approved, or physical evidence finds a different emergency
access requirement.

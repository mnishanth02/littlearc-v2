# OFF-04 Repository and Synchronization Engine

> **Status:** Complete
> **Started date:** 22 July 2026
> **Completed date:** 22 July 2026
> **Last updated:** 22 July 2026
> **Owner:** Engineering
> **Milestone:** M2
> **Work package:** `OFF-04`
> **Depends on:** Accepted Gate 1, `OFF-01`, `OFF-02`, and `OFF-03`
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
> **Inputs:** [roadmap](../roadmap.md),
> [architecture](../../core/littlearc-architecture-and-tech-stack.md),
> [backend data model](../../core/backend-data-model-and-database-schema.md),
> [mobile flow](../../core/mobile-application-flow.md), and
> [OFF-03 boundary](./off-03-local-security-and-enrollment-plan.md)
> **Decision:** [ADR-0012](../../adr/0012-server-authoritative-synchronization-and-conflict-boundary.md)

---

## Outcome

An enrolled and unlocked mobile installation reads an authorized child profile
from SQLCipher, keeps an ordered durable mutation queue, synchronizes through a
server-authoritative household API, survives duplicate retries and cursor
reset, preserves pending work through reconciliation, and presents stale
critical-field conflicts for explicit review.

## Scope

- Add a signed opaque cursor contract for household-ordered incremental pull.
- Add a paginated initial/reset snapshot that captures a change sequence before
  reading resources so concurrent changes are not lost.
- Implement the first production repository adapter for the existing child
  profile aggregate. Child identity fields are critical and never use silent
  last-write-wins.
- Implement ordered local UUIDv7 mutations with per-mutation idempotency keys,
  explicit dependencies, attempts, retry time, and terminal status.
- Implement batch mutation push with independent results: `applied`,
  `duplicate`, `conflict`, or `rejected`.
- Atomically update a child plus audit, change-feed, outbox, and idempotency
  evidence on successful mutation.
- Apply pull pages transactionally, propagate tombstones, and keep a safe local
  copy when a tombstone or conflict meets a pending edit.
- Stage reset snapshots before replacing the read model. Preserve pending and
  conflicted local work, then resume from the snapshot's captured sequence.
- Add bounded exponential retry with full jitter. Authentication pauses sync,
  authorization/validation rejects unsafe writes, and server/network failures
  retry.
- Use TanStack Query only to coordinate unlocked lifecycle refresh. SQLCipher
  remains the read model and mutation source of truth.
- Add a development-only synthetic Android flow for initial reconciliation,
  offline optimistic edit, push, duplicate replay, remote stale-revision
  conflict, tombstone application, and cursor-expiry rebuild.
- Warn and require explicit confirmation before sign-out discards pending or
  conflicted local work.

## Out Of Scope

- OFF-05 emergency-card fields, UI, quick access, or emergency version history.
- New record, consent, task, file, upload, reminder, or capsule repositories.
- Child create/delete through sync. Broad deletion, retention, restore, and
  recent-reauthentication policy remain with their owning trust packages.
- Silent critical-field merge, automatic conflict choice, or client authority
  over household, actor, revision, audit, or change sequence.
- Unattended locked-device background access to biometric-protected SQLCipher.
  Sync runs on manual, reconnect, or foreground triggers only after unlock.
- Real parent, child, participant, or medical data; live providers; physical
  iOS; a second physical device; or the complete pre-pilot device matrix.
- Selecting a time-based cursor retention promise. Expiry behavior is
  implemented from the retained sequence floor; the duration remains an
  observed-data and privacy/legal decision.

## Reviewed Decisions

1. Use the existing child profile as the first repository aggregate rather
   than inventing a production sync-probe entity. The physical harness supplies
   only fixed synthetic values.
2. Support child-profile `update` in mutation push. Other entity/operation
   pairs receive a typed rejection until their domain package defines policy.
3. Sign cursors with an HMAC key derived from the accepted wrapping secret by a
   dedicated context string. A client cannot raise a sequence and skip changes.
4. Return `resetRequired` for an absent/expired cursor and use a separate
   paginated snapshot contract. The captured sequence closes the snapshot race.
5. Keep completed mutation rows as bounded local history so dependent
   mutations remain provably unblocked. Retention compaction is a later
   operational policy.
6. Preserve optimistic content when a remote revision arrives. Store the
   server copy separately and create a conflict artifact instead of overwriting
   the parent's edit.
7. Keep server change payloads minimized. Authorized child content is decrypted
   from the current aggregate only at the API boundary and is never written to
   audit, outbox, idempotency fingerprint, or logs.
8. Treat the OFF-03 protected-key boundary as stronger than unattended
   background refresh. No sync path may bypass the biometric policy.

## Module Status

| Module | Status | Notes |
| --- | --- | --- |
| Plan and protocol review | Completed | Scope, first aggregate, cursor integrity, reset race, conflict policy, key custody, and evidence boundary finalized. |
| Domain and contracts | Completed | Sync status, retry/dependency policy, child projection, pull/snapshot/push contracts, and generated clients accepted. |
| PostgreSQL sync service | Completed | Tenant context, signed cursor floor, snapshots, atomic child update, audit/change/outbox/idempotency, conflict, and tombstone reads passed integration. |
| Mobile SQLCipher repositories | Completed | Schema V2, child repository, queue, conflicts, tombstones, reset staging, and pending-write warning passed tests and device proof. |
| Mobile lifecycle coordinator | Completed | TanStack Query coordinates unlocked status while SQLCipher retains all persisted truth. |
| Automated and physical validation | Completed | 151 tests, Aiven PostgreSQL, repository gates, builds, clean checkout, and bounded Pixel 8 flow passed. |

## Implementation Plan

1. Accept an ADR for server authority, signed cursors, captured-sequence reset,
   critical conflict behavior, local durability, and locked-device pause.
2. Add domain policy for dependency readiness, retry/backoff, mutation state,
   and sign-out discard classification with deterministic tests.
3. Extend contracts and OpenAPI with child projection, pull, snapshot, mutation
   push, per-item outcomes, reset reasons, bounds, and Problem Details.
4. Implement signed feed/snapshot cursor codecs and adversarial tests for
   tampering, wrong kind, invalid bounds, future sequence, and malformed data.
5. Implement PostgreSQL reads under session-derived household context. Return
   ordered changes, detect cursor expiry from the retained sequence floor, and
   capture a snapshot sequence before stable child-ID pagination.
6. Implement child-profile mutation persistence. Resolve actor/household from
   the session, check idempotency and base revision, encrypt the replacement,
   and atomically write child, success audit, change event, outbox event, and
   stored result. Persist conflict/rejection replay without domain writes.
7. Add local schema V2 and repository APIs. Enqueue the optimistic update and
   mutation in one transaction; select only dependency-ready due work; apply
   each result; and expose repository reads without network ownership.
8. Implement transactional pull/tombstone application and staged full reset.
   Keep pending/conflicted local copies and finalize the cursor only after the
   complete snapshot succeeds.
9. Implement the sync engine and TanStack Query lifecycle adapter. Push due
   mutations, pull until drained, handle reset, update retry state, and return
   status metadata only.
10. Add the development-only Android validation route and temporary Aiven
    harness. Exercise actual SQLCipher, HTTP, PostgreSQL, encryption, RLS,
    audit, change, outbox, conflict, tombstone, duplicate, and reset paths.
11. Run focused tests, database integration, generated-output drift twice,
    root tests/build/validation, Expo Doctor, Android/iOS exports,
    clean-checkout proof, physical Android flow, logcat review, and final diff
    review before recording completion.

## Acceptance Criteria

- Pull and snapshot require an authenticated identity with one active household
  membership. No request may select household, actor, role, or server sequence.
- Opaque cursors are integrity protected, kind-bound, versioned, bounded, and
  rejected when malformed, tampered, or ahead of server authority.
- Incremental pull is strictly sequence ordered and paginated. Empty supported-
  entity pages still advance over authorized unsupported events without losing
  later changes.
- An initial or expired cursor produces a typed reset. Snapshot pages share one
  captured sequence; changes committed later are received incrementally.
- Local reset staging never exposes a partial replacement and preserves queued,
  retrying, rejected, or conflicted edits and their readable safe copies.
- An optimistic child edit and its mutation are committed together in
  SQLCipher. Reads immediately return the local value and explicit sync state.
- Dependencies gate mutation dispatch. A failed/conflicted dependency blocks
  its dependent; a completed dependency permits it. One failed item does not
  discard unrelated ready work.
- Exact mutation retry returns `duplicate` with the prior applied revision and
  produces no additional child revision, audit row, change row, or outbox row.
  Reusing an idempotency key with changed content is rejected.
- A current critical child revision updates atomically with audit, change,
  outbox, and stored idempotency result. A stale revision produces a reviewable
  conflict and no child/change/outbox write.
- A server tombstone removes an unmodified local row. If local pending work
  exists, the tombstone wins for synchronization while the safe local proposal
  remains explicitly reviewable and cannot be pushed as a resurrection.
- Authentication pauses without incrementing permanent failure state;
  authorization and validation become terminal typed rejections; retryable
  failures use bounded exponential full jitter.
- TanStack Query caches only sync-run status. Killing/restarting the app or
  clearing Query state cannot remove repository rows, queued work, cursors, or
  conflicts.
- Sign-out with pending, retrying, rejected, or conflicted work requires an
  explicit discard decision before OFF-03 wipe runs.
- The physical Android proof completes the fixed synthetic flow through native
  SQLCipher and the real HTTP/PostgreSQL path. A server-simulated second writer
  is labeled separately from a second physical device.

## Validation

- Domain, contract, cursor, database, API, pure mobile repository, retry,
  coordinator, and local-migration tests.
- Aiven PostgreSQL initial snapshot, stable pagination, concurrent change,
  incremental pull, duplicate replay, changed-fingerprint rejection, atomic
  success, stale conflict, cursor expiry, tombstone, RLS/BOLA, and rollback.
- Mobile native schema V1-to-V2 migration, optimistic read, process reopen,
  dependency ordering, retry state, page transaction, reset staging, conflict
  preservation, tombstone behavior, and sign-out warning.
- Physical Pixel 8 initial reset, offline local update, applied push, duplicate
  replay, simulated remote stale conflict, tombstone, expired-cursor rebuild,
  process restart, accessibility semantics, and logcat fatal/canary review.
- Generated-output drift twice, root test/build/`pnpm validate`, Expo Doctor,
  `git diff --check`, documentation checks, and clean-checkout proof using Node
  24.18.0 and pnpm 11.14.0.

## Risks And Controls

| Risk | Control | Completion evidence |
| --- | --- | --- |
| Cursor tampering skips revocation or tombstones | HMAC-derived, kind-bound cursor plus server-head bound | Tamper/future-sequence tests pass. |
| Snapshot races lose concurrent writes | Capture change head before stable snapshot pages and resume from it | Concurrent integration scenario passes. |
| Reset destroys offline work | Stage server snapshot and preserve nonterminal proposals/conflicts | Local and native reset tests pass. |
| Duplicate retry duplicates history | Actor/household/key reservation plus fingerprint and stored result | Row-count integration assertions pass. |
| Critical edit silently overwrites another device | Conditional revision and explicit conflict artifact | Physical and integration conflict pass. |
| Background sync weakens app lock | Run only through an already unlocked database capability | Locked/unauthenticated pause tests pass. |
| Sign-out silently discards offline changes | Count risky states and require explicit confirmation | Policy/UI semantics pass. |
| Synthetic harness is mistaken for broad device evidence | Name the fixed values and simulated remote writer/reset controls | Evidence dossier states the exact boundary. |

## Evidence

Automated, PostgreSQL, repository, build, clean-checkout, and bounded physical
Android evidence is accepted in the
[OFF-04 implementation evidence dossier](./off-04-implementation-evidence.md).

## Follow-Up

- OFF-05 consumes the child repository/sync engine for emergency-card versions
  and its explicit conflict-review UI.
- Later domain packages register additional entity codecs and mutation policy;
  they do not bypass the shared queue, cursor, or conflict boundary.
- Cursor duration, mutation-history compaction, physical iOS, two physical
  devices, and locked/background operating limits remain named later-gate work.

# ADR-0012: Server-Authoritative Synchronization and Conflict Boundary

> **Status:** Accepted
> **Date:** 2026-07-22
> **Owner:** Engineering
> **Review date:** 2026-10-22
> **Supersedes:** None
> **Superseded by:** None
> **Related documents:** [OFF-04 plan](../impl-plan/m2-offline-trust/off-04-repository-and-synchronization-engine-plan.md), [architecture](../core/littlearc-architecture-and-tech-stack.md), [backend data model](../core/backend-data-model-and-database-schema.md), and [ADR-0011](./0011-local-key-custody-app-lock-and-device-enrollment.md)

---

## Context

LittleArc needs a durable offline read model and mutation queue without creating
a second source of truth. The synchronization boundary must prevent cursor
tampering, avoid data loss during a multi-page reset, keep household authority
on the server, make critical stale edits reviewable, and preserve local work
when access or server state changes.

The OFF-03 database key is protected by a biometric prompt. Unattended access
while the application is locked would weaken that accepted control.

## Decision

- PostgreSQL remains authoritative. SQLCipher stores the device read model,
  ordered mutations, cursor, tombstones, snapshot staging, and conflicts.
- Derive a dedicated HMAC signing key from the accepted wrapping-secret material
  using the `littlearc-sync-cursor-v1` context. Feed and snapshot cursors are
  versioned, kind-bound, opaque, integrity protected, and bounded by the server
  head.
- Treat an absent or expired feed cursor as a typed reset. Capture the server
  change sequence before stable child-ID snapshot pagination, stage all pages,
  then replace the read model transactionally and resume changes from the
  captured sequence.
- Preserve pending, retrying, rejected, and conflicted proposals during reset.
  A remote tombstone prevents resurrection but may retain an explicitly marked
  local proposal for review.
- Give every mutation a UUIDv7 mutation ID and idempotency key. Process a batch
  in dependency order and report an independent `applied`, `duplicate`,
  `conflict`, or `rejected` result for each item.
- Resolve household, membership actor, role, current revision, audit fields,
  and sequence server-side. A successful child-profile update writes the child,
  audit, change, outbox, and bounded idempotency result in one transaction.
- Treat child identity fields and future emergency/clinical fields as critical.
  A stale base revision stores both proposals for explicit review; it never
  silently applies last-write-wins.
- Use TanStack Query only to initiate and report a synchronization run. Clearing
  its cache cannot remove domain rows, mutations, cursors, tombstones, or
  conflicts.
- Run foreground, reconnect, or manual refresh only through an already unlocked
  SQLCipher capability. Authentication or app lock pauses synchronization; no
  background path bypasses biometric key protection.
- Require explicit confirmation before sign-out wipes pending or reviewable
  local work.

## Alternatives Considered

- Unsigned base64 cursors: rejected because a client could advance a sequence
  and skip changes or tombstones.
- Server-side cursor rows for every device: rejected for the initial engine
  because signed stateless cursors preserve the accepted local-cursor model and
  avoid a new operational table.
- Replace local tables page by page during reset: rejected because interruption
  would expose a partial household read model.
- Silent last-write-wins for child identity or emergency fields: rejected
  because it can hide a clinically or operationally important disagreement.
- Store domain objects in TanStack Query persistence: rejected because it would
  create a second local truth and weaken SQLCipher transaction guarantees.
- Unattended locked-device SQLCipher access: rejected because it conflicts with
  ADR-0011 key custody.

## Consequences

The first OFF-04 production mutation is intentionally narrow: update an existing
child profile. Later packages register their own entity codecs and authorization
rules while reusing the same queue, cursor, reset, and conflict boundary.
Snapshot reads may include a newer duplicate of a change committed after the
captured sequence; the subsequent incremental event is idempotent and no change
is lost.

Cursor retention duration and local completed-mutation compaction remain
operational/privacy decisions. Physical Android proof uses one device plus a
server-simulated second writer and cannot be reported as two-device evidence.

## Validation

Unit and contract tests cover dependency ordering, jitter bounds, sign-out risk,
cursor tampering/kind binding, route validation, local optimistic state,
conflict preservation, tombstones, and schema migration. PostgreSQL integration
covers RLS, snapshot/pull, atomic apply, exact duplicate, changed replay, stale
conflict, rollback, and plaintext canaries. The bounded physical Android flow
covers actual SQLCipher, offline queueing, HTTP/PostgreSQL synchronization,
duplicate replay, simulated remote conflict, tombstone, cursor reset, process
restart, explicit discard, and verified wipe.

## Review Triggers

Review by 2026-10-22, or earlier when cursor-key rotation is required, multiple
households per identity are accepted, another aggregate adds a merge policy,
background execution requirements change, retained sequence duration is set,
completed mutation compaction is introduced, or conflict resolution becomes a
product UI in OFF-05.

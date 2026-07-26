# OFF-04 Implementation Evidence

> **Status:** Accepted
> **Last updated:** 22 July 2026
> **Owner:** Engineering
> **Work package:** `OFF-04`
> **Plan:** [OFF-04 Repository and Synchronization Engine](./off-04-repository-and-synchronization-engine-plan.md)
> **Decision:** [ADR-0012](../../adr/0012-server-authoritative-synchronization-and-conflict-boundary.md)

---

## 1. Implemented Outcome

LittleArc now has a synthetic-only repository and synchronization engine. An
enrolled, unlocked mobile installation reads a child projection from SQLCipher,
commits an optimistic edit and ordered mutation together, pushes through an
authenticated household API, pulls authoritative changes, survives exact
replay and cursor reset, preserves a stale critical-field proposal for review,
applies tombstones without resurrecting server-deleted data, persists through a
process restart, and warns before sign-out discards risky local work.

This package does not implement OFF-05 emergency-card content or product UI,
real household data, unattended locked-device background access, physical iOS,
or a two-device acceptance claim.

## 2. Implemented Boundary

- Signed, versioned, kind-bound HMAC cursors protect ordered change and snapshot
  positions. Pull detects expired or ahead-of-authority positions; reset uses a
  captured change sequence and stable child-ID pagination.
- Authenticated API routes expose incremental pull, reset snapshots, and batch
  mutation push. The request cannot select its household, actor, role, revision,
  audit identity, or change sequence.
- PostgreSQL synchronization runs under the accepted tenant/RLS context.
  Successful child-profile updates atomically write the encrypted aggregate,
  audit event, change event, outbox event, and idempotency result.
- Local schema V2 persists child projections, ordered UUIDv7 mutations,
  dependencies, attempts, next retry time, terminal state, conflicts,
  tombstones, cursors, and staged reset snapshots inside SQLCipher.
- Critical child identity changes use conditional base revisions. A stale edit
  creates an explicit conflict and retains both the local proposal and the
  authoritative server projection; it is never silently last-write-wins.
- TanStack Query coordinates an unlocked synchronization run and caches status
  only. SQLCipher remains the domain read model, mutation queue, cursor, and
  conflict source of truth.
- Retry policy uses bounded exponential full jitter. Authentication pauses;
  unsafe authorization and validation results terminate; missing or failed
  dependencies block dispatch.
- Sign-out classifies pending, retrying, rejected, and conflicted work as risky
  and requires an explicit discard decision before the OFF-03 wipe boundary.

## 3. Review and Defect Closure

The plan review finalized server authority, the first child aggregate, cursor
integrity, reset-race closure, conflict preservation, locked-database access,
and the synthetic evidence boundary in ADR-0012 before implementation.

Physical-device validation then found and corrected two integration defects
that pure tests did not reproduce:

1. A Drizzle/PostgreSQL UUID-array interpolation used by incremental pull
   produced HTTP 500 after the first successful push. The child lookup now
   builds an explicitly parameterized `IN` list; the complete device rerun
   proved push followed by authoritative pull.
2. The development proof sent `content-type: application/json` on empty
   validation POSTs, which Fastify rejected with HTTP 400 before the simulated
   remote edit. The helper now emits that header only when a body exists; the
   complete conflict, tombstone, and cursor-reset flow passed afterward.

The final Aiven rollback run also exposed a stale assertion that accepted the
underlying PostgreSQL trigger text but not Drizzle's safe failed-query wrapper.
The assertion now accepts both representations and still proves that no child,
audit, change, outbox, or idempotency evidence survives the forced rollback.

## 4. PostgreSQL Integration Evidence

The Aiven harness created a fresh temporary database, applied the reviewed
migrations, retained OFF-02 and OFF-03 regression coverage, and proved:

1. initial reset, captured-sequence snapshot, stable pagination, and ordered
   incremental pull;
2. atomic apply plus stored result, exact duplicate replay without extra
   evidence, and changed-fingerprint rejection;
3. stale critical-field conflict without child/change/outbox mutation;
4. dependency and cross-household authorization rejection;
5. transaction rollback when outbox evidence fails; and
6. absence of seeded child plaintext from persisted encrypted envelopes,
   metadata, and operational evidence.

The physical server path finished at child revision 4 with four minimized
`child_updated` audit rows and three relevant outbox rows. Its temporary
database and synthetic-only API were stopped after evidence capture.

## 5. Validation Results

All commands use Node.js 24.18.0 and pnpm 11.14.0.

| Validation | Result |
| --- | --- |
| Focused domain, contracts, database, API, and mobile tests | Passed; synchronization policy, cursor integrity, contracts, service routing, local schema/repository, queue, conflict, reset, and sign-out coverage. |
| `pnpm test:database:sync` | Passed; OFF-02/OFF-03 regressions plus OFF-04 snapshot, pagination, pull, atomic apply, duplicate, mismatch, stale conflict, RLS/BOLA, rollback, and plaintext-canary cases. |
| Physical Android repository/sync lifecycle | Passed on Pixel 8, Android 17/API 37, through native SQLCipher, HTTP, and temporary Aiven PostgreSQL. |
| `pnpm check:generated` twice | Passed; generated OpenAPI document, JSON, and types are idempotent and drift-free. |
| `pnpm test` | Passed; 151 tooling, unit, and contract tests across the workspace. |
| `pnpm build` | Passed; package/server/staff builds and Android/iOS Hermes exports completed. |
| `pnpm --filter @littlearc/mobile run doctor` | Passed all 20 Expo project checks. |
| `pnpm validate` | Passed; toolchain, workspace, supply-chain, generated output, formatting, documentation, and 13-package typechecks passed. |
| `git diff --check` | Passed. |
| `./tooling/validate-clean-checkout.sh` | Passed from a source-only snapshot with frozen install and uncached workspace validation. |

## 6. Physical Android Evidence

The connected Pixel 8 reported Android 17/API 37. The accessible
development-only route completed this fixed synthetic sequence:

1. initialized local schema V2 and reconciled a signed reset snapshot;
2. disabled Wi-Fi and mobile data, committed an optimistic SQLCipher edit, and
   observed the queued local value;
3. re-enabled connectivity, pushed the mutation, and pulled revision 2;
4. replayed the exact mutation and confirmed the server stayed at revision 2;
5. simulated a server-side second writer at revision 3, submitted the stale
   local proposal, and reopened the explicit review artifact;
6. applied a revision-4 server tombstone while retaining the local proposal
   only for review and blocking resurrection;
7. advanced the retained sequence floor, performed a staged full reset, and
   preserved the conflicted proposal;
8. force-stopped and relaunched LittleArc, reopened the SQLCipher-backed review
   item without Query cache state; and
9. explicitly discarded one risky review item and verified the OFF-03 wipe.

UIAutomator observed the final
`OFF-04 physical Android validation passed` semantic state, and the screenshot
was visually reviewed. Server evidence reported revision 4, audit count 4, and
outbox count 3. A bounded logcat scan found no fatal Android runtime or seeded
canary matches.

The simulated remote writer is server-side test control, not a claim that two
physical devices were exercised.

## 7. Evidence Boundaries

The run used fixed synthetic content, synthetic sessions, and disposable
database state. It does not claim:

- real parent, child, participant, medical, file, or consent data;
- a live email/social provider, production credentials, or signed-store build;
- physical iOS, a second physical device, or the complete pre-pilot matrix;
- unattended background synchronization while SQLCipher is locked;
- a production cursor-retention duration or completed mutation compaction
  policy; or
- OFF-05 emergency-card fields, quick access, versions, or product acceptance.

## 8. Completion Decision

**Decision: COMPLETE.** OFF-04 meets its synthetic boundary through accepted
server-authority and cursor decisions, transactional PostgreSQL and SQLCipher
repositories, adversarial integration, all repository gates, and the complete
bounded Pixel 8 lifecycle. OFF-05 planning is ready next; the real-provider,
real-data, physical-iOS, two-device, and pre-pilot obligations remain unchanged.

## iOS Simulator Parity Follow-Up — 23 July 2026

The production custom development client passed enrollment, initial
reset/snapshot, offline queue, push/pull, exact replay, stale conflict,
tombstone, cursor expiry/reset, real process termination/relaunch, retained
SQLCipher resume, discard warning, and wipe. The second writer remained
server-simulated, so two-device and physical-iOS evidence stays open. See the
[cross-milestone parity dossier](../ios-simulator-parity-validation-evidence.md).

# VLT-01 Record Model, Versions, Provenance, and Timeline Projection Plan

> **Status:** Complete
> **Started date:** 2026-07-24
> **Last updated:** 2026-07-24
> **Completion date:** 2026-07-24
> **Owner:** Engineering
> **Milestone:** M3
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
> **Roadmap:** [M3 Vault Wedge](../roadmap.md#m3--vault-wedge)

---

## Outcome

LittleArc will have one server-authoritative, encrypted, versioned record
aggregate that later Vault packages can use without inventing category-specific
storage or synchronization paths. An authorized member can create a synthetic
confirmed record, correct it by appending a version, retrieve its current and
historical provenance, receive a linked Timeline projection, and delete it
through an immediate tombstone plus queued purge request.

The accepted outcome is infrastructure plus a development-only native
validation flow. Production manual record forms, Vault navigation, capture,
files, OCR, AI, search, reminders, and the user-facing Timeline arrive in their
own ordered packages.

## Authorization And Gate Boundary

Gate 2 remains open and the dashboard currently blocks general M3 feature
breadth. Founder direction on 24 July 2026 authorizes this bounded `VLT-01`
foundation package only so its high-risk record/version/projection boundary can
be implemented and validated.

This exception:

- does not claim Gate 2 closure;
- does not authorize `VLT-02` or later M3 packages;
- does not replace the missing two-physical-device, low-end Android, complete
  assistive-technology, or physical-iOS evidence;
- does not permit real child, parent, clinical, document, provider, or
  government data; and
- must remain visible in the roadmap, dashboard, M3 index, and final evidence.

## Scope

- Add framework-independent record lifecycle, provenance, version-content,
  Timeline projection, and authorization rules.
- Define typed OpenAPI and shared-sync contracts for current records, immutable
  versions, generated Timeline entries, mutations, conflicts, and tombstones.
- Add PostgreSQL `records`, `record_versions`, `record_suggestions`, and
  `timeline_entries` tables through reviewed migration `0005`.
- Implement a shared persistence command for create, correction, archive, and
  delete operations with idempotency, optimistic revision checks, audit,
  change-feed, outbox, immutable versions, Timeline projection, and purge
  request evidence in one transaction.
- Add authorized record detail and version-history queries. Database rows and
  cryptographic metadata never become API responses directly.
- Extend OFF-04 pull, snapshot, mutation, conflict, reset, and tombstone
  protocols for record and generated Timeline entities.
- Add SQLCipher schema V4, codecs, current-record and Timeline projections,
  version cache, optimistic proposals, conflict retention, reset preservation,
  and deletion handling.
- Add a development-only VLT-01 validation route that exercises the complete
  fixed-synthetic lifecycle through real native SQLCipher and HTTP.
- Add focused domain, contract, database, API, synchronization, local
  repository, security, privacy-canary, and performance tests.
- Validate on a connected physical Android device and the booted iOS Simulator,
  while describing the evidence boundary precisely.
- Create an implementation evidence dossier and align the dashboard, roadmap,
  M3 index, repository context index/map, core implemented/planned labels, and
  relevant ADR/index entries.

## Out Of Scope

- Production record create/edit/delete screens or category forms (`VLT-02`).
- Camera, scanner, gallery, file/PDF, share-sheet, or temporary-file handling
  (`VLT-03`).
- File encryption, object storage, upload sessions, or source attachments
  (`VLT-04`).
- OCR, extraction, suggestion generation, model/provider calls, or AI consent
  execution (`VLT-05`, `VLT-06`, `UTL-08`).
- Vaccination-specific projections and schedules (`VLT-07`).
- Vault browse, local FTS, server search, retrieval ranking, or production
  Timeline UI (`VLT-08`, `VLT-09`, `UTL-05`).
- Provider/government ingestion, issuer verification, digital signatures,
  interoperability adapters, or a user-visible `verified` claim.
- Hard purge execution or retention-duration selection. Delete queues a purge;
  the approved deletion package owns restartable physical purge.
- Arbitrary per-record ACLs, multi-household identities, staff content access,
  sharing/export, recovery, or partner access.
- Background synchronization while SQLCipher is locked.
- Real data, live identity/provider credentials, signed store distribution,
  physical iOS, or Gate 2/pre-pilot closure.

## Source Traceability

| Requirement | Source |
| --- | --- |
| Package scope and order | Roadmap Sections 12 and 18–21 |
| Record fields, suggested/confirmed separation, correction, encryption | Architecture Sections 13.1–13.4 |
| Planned tables, lifecycle, retention, and performance targets | Backend data model Sections 7–12 and 21–25 |
| Parent-owned provenance and correction policy | Product plan Sections 14.4, 26.5, 27, and 31.5 |
| Record and Timeline states plus failure behavior | Mobile application flow record, capture, lifecycle, and error sections |
| Server authority, signed cursors, reset, conflict, and locked-sync boundary | ADR-0012 |
| Household encryption, authorization, and local key custody | ADR-0010 and ADR-0011 |
| Privacy-safe telemetry | ADR-0007 and engineering data classification |
| Reviewed forward-only migrations | ADR-0005 and database migration guidance |

## Dependencies

- `FND-04` contracts/domain kernel, `FND-05` database foundation, `FND-07`
  privacy-safe observability, and `FND-08` semantic UI foundations.
- `OFF-01` session lifecycle and server-derived identity.
- `OFF-02` household, child, membership, consent, envelope encryption, RLS, and
  audit boundaries.
- `OFF-03` SecureStore/SQLCipher enrollment, key custody, schema migration, and
  wipe behavior.
- `OFF-04` shared repository, ordered mutation queue, signed cursors, reset,
  tombstones, idempotency, conflicts, and unlocked-only synchronization.
- `OFF-05` immutable aggregate/version and development-device validation
  patterns.
- Node.js 24.18.0, pnpm 11.14.0, ignored local `.env.aiven`, a disposable Aiven
  PostgreSQL database, a physical Android device connected through ADB, and the
  installed iOS Simulator development client.

## Reviewed Decisions

1. **One generic record aggregate, not category tables.** `records` owns
   queryable lifecycle metadata and points to an immutable current
   `record_version`. VLT-02 and later packages add category content validators
   without creating parallel persistence or sync engines.
2. **Versioned bounded payload.** `RecordVersionContentV1` contains common
   encrypted display content and a bounded category payload. The first accepted
   category payload is `document.v1`; later category schemas extend the
   discriminated union while preserving `payloadSchemaVersion`.
3. **Provenance is source plus actor context.** The accepted source values are
   `manual`, `imported`, `ocr_assisted`, `ai_assisted`, `provider_issued`, and
   `government_imported`. A caregiver-entered record is represented by its
   membership actor and capability, not a duplicate source enum.
4. **Verified provenance cannot be self-asserted.** Ordinary consumer
   mutations may use only the package-authorized source values. Provider- and
   government-issued states are represented in contracts/storage but require a
   future trusted adapter and issuer evidence before a client can create them.
5. **Suggestions remain separate and non-authoritative.**
   `record_suggestions` owns encrypted suggested value/source span and review
   metadata. A suggestion never appears in a confirmed version, Timeline, or
   search authority until explicit confirmation creates a new version.
6. **Correction appends; it never overwrites.** A confirmed correction appends
   exactly one immutable version, advances the current pointer and revision,
   retains the original provenance, and records parent/caregiver annotation
   context without mutating provider-issued source material.
7. **Generated Timeline rows are projections.** Every confirmed current record
   has one active generated Timeline entry linked to its record and current
   version. Correction deactivates the prior generated entry and inserts the
   new version projection. Archive/delete deactivates or tombstones the active
   projection. Timeline payloads are encrypted summaries, not independent
   authoritative copies.
8. **Unknown clinical dates are explicit.** A confirmed record may omit its
   clinical `eventAt`. Its generated Timeline entry then uses `confirmedAt` for
   ordering and carries an encrypted `confirmedAtFallback` date-authority
   label, so the UI cannot present upload/confirmation time as a clinical date.
9. **Access policy is server derived.** Identity records require
   `viewIdentityDocuments`; other MVP records require
   `viewSelectedHealthRecords`; create/correct uses `addRecords` and
   `editConfirmedRecords`. Stored access policy is a validated, server-derived
   scope and cannot grant authority.
10. **Clinical records are critical conflicts.** Stale confirmed corrections
    preserve local and authoritative proposals for review. There is no
    field-level automatic merge or last-write-wins.
11. **Delete is immediate logical removal.** Delete increments the aggregate
    revision, writes record and Timeline tombstones, blocks stale resurrection,
    appends minimized audit/change/outbox evidence, and queues a
    `record.purge_requested` event. Hard purge waits for the approved retention
    and deletion workflow.
12. **PostgreSQL remains authoritative; SQLCipher is the protected cache.**
    Current record/Timeline projections and explicitly fetched history may be
    cached locally. Synchronization runs only after unlock and reuses ADR-0012.
13. **No production UI in VLT-01.** A development-only, release-excluded route
    proves the native end-to-end lifecycle. VLT-02 owns the accessible
    production manual form and correction interaction.
14. **No new production dependency.** The package uses current domain,
    contracts, crypto, database, API, observability, Expo, and SQLCipher
    boundaries.

## Data And Trust Review

### Data classification and storage

| Data | Classification | Treatment |
| --- | --- | --- |
| Household, child, record/version IDs | Sensitive | Queryable only where required; never analytics |
| Category, source/provenance class, confirmation state, revision, event time | Internal/health-adjacent | Bounded queryable metadata required for filtering, conflict, and Timeline order |
| Title, provider/facility, notes, category fields, annotation, Timeline summary | Restricted child/health | AES-256-GCM household envelope in PostgreSQL; SQLCipher on device |
| Suggested value and source span | Restricted child/health | Separate AES-256-GCM envelopes; never confirmed authority |
| Actor/action/time, request and mutation IDs | Regulatory/operational evidence | Minimized append-only audit/idempotency/change/outbox metadata |
| Issuer proof/provider payload | Future restricted/integration | Not collected by VLT-01 |

PostgreSQL plaintext-canary checks must cover title, provider/facility, note,
structured value, annotation, suggestion, source span, and Timeline summary.
Logs, analytics, errors, audit metadata, outbox metadata, change metadata, and
device logs must contain none of those values.

### Authorization and RLS

- Resolve household, membership, role, granted capabilities, actor, access
  scope, revision, and server timestamps from the authenticated session.
- Require active same-household membership for every query or mutation.
- Owner may create, view, correct, archive, and delete.
- Caregiver requires the applicable view capability plus `addRecords` for
  create and `editConfirmedRecords` for correction. Delete/archive remain owner
  operations in VLT-01.
- Identity records require `viewIdentityDocuments`; other accepted categories
  require `viewSelectedHealthRecords`.
- Staff and device identifiers grant no content authority.
- Every tenant/child/actor/source FK includes `household_id`; forced RLS applies
  to all four new tables.

### Consent, retention, audit, and visibility

- VLT-01 manual synthetic records rely on the accepted child-data-processing
  consent boundary. No third-party processor or cloud-AI consent is exercised.
- Suggestions carry nullable processor-consent references at the schema level;
  any future cloud suggestion requires a same-household active consent event.
- User-visible delete tombstones immediately. Physical purge timing stays TBD
  and blocks real data, not this synthetic package.
- Audit records action, actor, target, request, and time only. It never records
  title, notes, clinical values, provenance detail, suggestion content, or
  Timeline summary.
- Operations staff receive workflow metadata only and no record/version,
  suggestion, or Timeline content access.
- No new analytics event is required for this foundation package. The
  development validation route emits no product analytics.

### Abuse and failure controls

- Reject household, child, actor, access-policy, issuer, revision, confirmation,
  audit, or Timeline authority supplied outside the accepted command fields.
- Reject changed-content replay under a reused idempotency key.
- Reject stale confirmed corrections with a typed conflict and no accepted
  version/projection write.
- Reject unsupported payload schema/category combinations, unbounded encrypted
  plaintext, malformed envelopes, invalid dates, and client-asserted trusted
  provenance.
- Make `record_versions` application-insert-only and trigger-reject update or
  delete. Suggestions are not allowed to update confirmed versions.
- Preserve tombstone-wins semantics across retry, reset, and offline proposals.
- Ensure a failed audit/change/outbox/Timeline/version step rolls back the
  entire business mutation.

## Contract And Failure Design

### Domain model

- `RecordCategory`, `RecordSourceType`, `RecordConfirmationState`, and
  server-derived `RecordAccessScope`.
- `RecordVersionContentV1` with bounded common fields and `document.v1`
  category payload.
- `RecordProvenance`, `RecordProjection`, `RecordVersionProjection`, and
  `GeneratedTimelineProjection`.
- Pure assertions for source authorization, state transitions, confirmation
  actor/time pairing, version succession, payload/category compatibility,
  Timeline date authority, and capability checks.

### API and shared sync

- Activate `/v1/records` resource contracts for authorized detail and
  cursor-paginated immutable version history.
- Extend shared sync entity variants with `record` and `timelineEntry`.
- Add record create/correct/archive/delete mutations with UUIDv7 mutation and
  idempotency IDs, local dependencies, base revision, bounded content, and
  explicit source.
- Return stable Problem Details for validation, authorization, not found,
  stale critical revision, idempotency mismatch, tombstone wins, unsupported
  provenance, and payload-schema mismatch.
- Exact retry returns the stored result and creates no second version, Timeline
  entry, audit, change, outbox, or purge request.

### PostgreSQL migration

Migration `0005_vlt_01_record_foundation.sql` will add:

- `records` with queryable metadata, server-derived access policy, current
  version pointer, revision, actor IDs, and tombstone state;
- immutable `record_versions` with version number, payload schema, encrypted
  content, confirmation/provenance context, supersession link, and actor/time;
- `record_suggestions` with separate encrypted suggestion/source-span fields,
  extractor metadata, consent reference, review state, and expiry; and
- `timeline_entries` with child/time ordering, record/version links, encrypted
  summary, visibility, projection state, revision, actors, and tombstone state.

The migration includes same-household composite FKs, deferrable current-version
integrity, partial active indexes, generated-projection uniqueness, envelope
checks, forced RLS, least-privilege grants, immutable-version trigger, and
forward-only compatibility. No `db:push` is used.

### SQLCipher schema V4

- Migrate V3 to V4 transactionally.
- Add current record, cached version, generated Timeline, and conflict tables
  plus mutation codecs.
- Preserve V1–V3 child/emergency data and pending/conflicted work.
- Keep optimistic record plus mutation writes atomic.
- Apply record/Timeline server pages idempotently.
- Preserve nonterminal local proposals through staged reset.
- Remove/tombstone current and Timeline projections immediately on authorized
  server delete or access loss.
- Make sign-out risk detection include pending/rejected/conflicted records.

### User-visible and harness states

The development harness must distinguish setup, local confirmed, syncing,
authoritative, corrected, offline pending, stale conflict, history verified,
deleted/tombstoned, reset verified, access denied, wipe verified, retryable
error, and terminal failure. It uses semantic components and accessibility
labels but is not accepted as the production Vault/record experience.

### Compatibility, rollout, and rollback

- Generated clients and older app builds must keep child/emergency sync
  behavior. New entity variants require the normal coordinated app/API
  compatibility boundary; the development package is not deployed to
  production.
- Additive PostgreSQL migration `0005` is forward-only. Application rollback
  leaves unused tables intact; destructive rollback is not promised.
- SQLCipher V4 migration is forward-only under the accepted wipe/resync
  recovery path.
- The validation route remains development-only and must be absent from Android
  and iOS release exports.
- No feature flag or kill switch is added because VLT-01 exposes no production
  feature. VLT-02 owns product rollout control if required.

## Module Status

| Module | Status | Notes |
| --- | --- | --- |
| Plan, source traceability, and gate review | Completed | Scope, exclusions, gate exception, source conflicts, trust boundary, delivery slices, acceptance criteria, and validation plan reviewed. |
| ADR and domain model | Completed | ADR-0014, record/version/provenance content, authorization, transitions, and Timeline rules implemented and tested. |
| Contracts and generated clients | Completed | Typed record/history and shared-sync variants generated without child/emergency regression. |
| PostgreSQL migration and persistence | Completed | Migration `0005`, RLS, immutable versions, atomic mutations, generated Timeline, tombstones, and purge queue passed Aiven validation. |
| API and shared synchronization | Completed | Authorized reads/history plus record/Timeline mutation, pull, snapshot, reset, conflict, and tombstone paths implemented. |
| SQLCipher V4 and mobile sync | Completed | Local projections, history cache, optimistic proposals, conflicts, reset, wipe, and codecs implemented and tested. |
| Development native validation flow | Completed | Release-excluded fixed-synthetic route passed release-bundle containment. |
| Automated, Aiven, Android, and iOS validation | Completed | 193 root tests, validation, Aiven, Android/iOS release exports, iOS Simulator lifecycle, and the bounded physical Pixel 8 lifecycle/accessibility checks passed. |
| Evidence and documentation | Completed | [Evidence](./vlt-01-implementation-evidence.md), dashboard, roadmap, indexes, context map, and ADR links record the exact bounded result. |

## Implementation Plan

1. Record the aggregate/version/provenance/generated-projection decision in an
   ADR and add domain values, bounded content, lifecycle assertions,
   source-authorization rules, Timeline date authority, and capability checks.
2. Add record, version-history, generated-Timeline, mutation, conflict,
   tombstone, pull, and snapshot contracts. Generate OpenAPI artifacts and
   clients, review the diff, and keep existing child/emergency variants
   backward compatible.
3. Add the four typed Drizzle tables and reviewed migration `0005`. Test schema
   parity, exact envelope checks, same-household FKs, active uniqueness,
   immutable versions, RLS, grants, and generated-output idempotence.
4. Implement one transaction boundary for create/correct/archive/delete. It
   derives authority, reserves idempotency, checks revision/tombstone/source,
   encrypts and appends a version where applicable, advances the aggregate,
   refreshes/deactivates Timeline projection, writes audit/change/outbox, and
   stores the bounded result.
5. Add authorized record-detail and version-history queries. Decrypt only the
   requested bounded page under tenant context, keep suggestions separate, and
   expose no key or provider internals.
6. Extend OFF-04 persistence and routes for record and generated-Timeline
   pull/snapshot/mutation variants. Preserve deterministic ordering, signed
   cursor semantics, exact retry, dependency behavior, reset, tombstone wins,
   and explicit critical conflict review.
7. Add SQLCipher V4 and local repository behavior. Atomically queue optimistic
   records, apply authoritative record/Timeline pages, cache fetched immutable
   versions, preserve conflicts through reset/restart, and include record risk
   in sign-out wipe confirmation.
8. Extend the mobile synchronization coordinator with record codecs and
   Timeline projection dispatch while keeping all runs behind the unlocked
   SQLCipher capability.
9. Add the development-only VLT-01 route and disposable Aiven device harness.
   Exercise create, duplicate retry, offline correction, reconnect, two-version
   history, stale conflict, Timeline replacement, delete/purge queue,
   tombstone/reset, authorization denial, restart, and wipe with fixed
   synthetic canaries.
10. Run focused tests, Aiven integration, generated drift twice, package
    typechecks/builds, root tests/validation, Expo Doctor, Android/iOS exports,
    release-bundle containment, clean-checkout proof, physical Android, and iOS
    Simulator validation.
11. Perform final security/privacy, migration, OpenAPI, accessibility, and diff
    reviews. Fix all package-scoped failures and rerun affected gates.
12. Create the evidence dossier and align the plan, ADR index, M3/implementation
    indexes, context map, backend data-model implemented labels, dashboard, and
    roadmap. Mark `VLT-01` complete only within its exact synthetic/device
    boundary; keep Gate 2 and `VLT-02+` blocked.

## Acceptance Criteria

- First accepted confirmed create writes exactly one active record, one
  immutable encrypted version, one active encrypted generated Timeline entry,
  and one minimized audit/change/outbox set in one transaction.
- Draft or suggested values never create an active Timeline entry and never
  appear as confirmed content.
- A confirmed correction appends exactly one new version, advances the current
  pointer/revision, preserves source and actor context, deactivates the prior
  Timeline projection, and activates the new version projection.
- Immutable versions cannot be updated or deleted by application, worker, or
  operations roles outside a future terminal purge workflow.
- Manual/import/OCR/AI/provider/government source values are representable, but
  ordinary client mutations cannot self-assert provider/government provenance.
- Exact retry returns the stored result with no duplicate version, Timeline,
  audit, change, outbox, or purge request. Changed replay fails closed.
- A stale confirmed correction creates a reviewable conflict with local and
  authoritative content and accepts no record/version/Timeline write.
- Owner and precisely capable caregivers can perform allowed operations;
  missing capability, identity-category mismatch, another household, staff,
  or device-ID-only access returns no content or existence leak.
- PostgreSQL, logs, analytics, errors, audit/change/outbox/idempotency metadata,
  generated artifacts, screenshots, and device logs contain none of the seeded
  restricted plaintext canaries.
- Pull and stable snapshot carry record and generated-Timeline upserts and
  tombstones deterministically without regressing child/emergency behavior.
  Cursor expiry and process restart preserve nonterminal record proposals and
  conflicts.
- Delete immediately removes the current record/Timeline projection from
  authorized reads, emits tombstones, blocks stale resurrection, and queues one
  minimized purge request. No hard-purge timing claim is made.
- SQLCipher V4 preserves V3 data, stores protected current/history/Timeline
  state, queues changes atomically, and makes record content inaccessible after
  accepted sign-out wipe.
- The development validation route is absent from release Android and iOS
  bundles.
- The fixed synthetic lifecycle passes on a physical Android device and iOS
  Simulator through native SQLCipher, HTTP, disposable Aiven PostgreSQL,
  restart/offline/reconnect/conflict/delete/reset/wipe behavior, and accessible
  semantic status output.
- Existing unit, contract, Aiven, mobile, build, generated-output, docs,
  validation, and clean-checkout gates pass.
- Documentation states the exact gate exception and does not claim Gate 2,
  physical iOS, two-physical-device, low-end Android, live provider, real-data,
  production-deployment, or later-M3 completion.

## Validation

Use Node.js 24.18.0 and pnpm 11.14.0.

### Focused

```sh
pnpm --filter @littlearc/domain test
pnpm --filter @littlearc/contracts test:contract
pnpm --filter @littlearc/database test
pnpm --filter @littlearc/api test
pnpm --filter @littlearc/mobile test
pnpm test:database:record
```

The disposable Aiven suite must prove encrypted create/correction/history,
separate suggestions, exact replay, changed replay, stale conflict, generated
Timeline lifecycle, archive/delete/tombstone/purge request, BOLA/RLS,
capabilities, immutable grants/triggers, rollback, stable pagination, reset,
target-scale query behavior, and plaintext-canary absence.

### Generated, static, and repository

```sh
pnpm check:generated
pnpm check:generated
pnpm test
pnpm typecheck
pnpm build
pnpm --filter @littlearc/mobile run doctor
pnpm validate
git diff --check
./tooling/validate-clean-checkout.sh
```

Review generated OpenAPI, client, and migration diffs. The second generated
check proves idempotence. Release exports must pass validation-bundle
containment for both platforms.

### Physical Android

On the actually connected device:

1. Record `adb devices -l`, model, OS/API, build type, and installed app version.
2. Enroll/unlock synthetic storage and create/sync the fixed record.
3. Confirm current record, provenance, Timeline link, and version 1 through the
   native harness.
4. Disable API reachability, force-stop, relaunch, and verify protected cached
   state before any successful network call.
5. Correct offline, reconnect, sync version 2, and verify immutable history plus
   Timeline replacement.
6. Create a stale critical proposal against a server-side synthetic writer and
   verify explicit conflict without silent merge.
7. Delete, verify immediate record/Timeline tombstones and one purge request,
   expire/reset the cursor, and verify no resurrection.
8. Exercise authorization denial, risky-work discard, sign-out wipe, and
   post-wipe inaccessibility.
9. Inspect semantic labels, 200% font scale, high contrast, narrow layout,
   scrolling, touch targets, current-process logcat, crash state, and canaries.
10. Restore every changed device setting and remove ADB reverse rules.

### iOS Simulator

On the booted simulator:

1. Record simulator model, runtime, UDID, build type, and app version.
2. Repeat create/sync, API-offline termination/relaunch, offline correction,
   reconnect/version history, stale conflict, delete/tombstone/reset, access
   denial, discard, and wipe.
3. Exercise 200% Dynamic Type, VoiceOver semantic inspection where available,
   increased contrast/dark appearance, narrow/scroll states, and restart.
4. Scan current-process logs and release bundles for seeded canaries and
   development-validation code.

Simulator evidence is not physical-iOS, radio-off, store-distribution, signing,
upgrade, or complete assistive-technology evidence.

## Evidence

Create
[the implementation evidence](./vlt-01-implementation-evidence.md) after the
accepted checks pass or are explicitly bounded. Record commands, counts,
versions, device facts, failures fixed, bounded observations, and unresolved
manual obligations without recording credentials, service identifiers, or
restricted content.

## Risks And Blockers

| Risk or blocker | Impact | Control / resolution |
| --- | --- | --- |
| Gate 2 remains open | General M3 breadth is not ready | Keep the package-specific founder exception explicit; do not start `VLT-02+` |
| Physical iOS is unavailable/request excludes it | Roadmap mobile quality gate cannot be claimed broadly | Accept only the requested iOS-Simulator boundary; retain physical-iOS obligation |
| Target low-end Android and complete assistive-technology matrix remain unproven | Gate 2 stays open | Run the named matrix separately before Gate 2 closure |
| Suggestion/provider/government adapters do not exist | Provenance values could be overstated | Reserve trusted values, reject consumer self-assertion, and test only fixed synthetic/manual behavior |
| Purge duration and retention remain TBD | Hard-delete completion cannot be claimed | Queue one minimized purge request; block real data until approved policy and deletion workflow |
| Generic payload becomes an unbounded schema escape hatch | Later categories could bypass validation | Accept only bounded versioned common content plus discriminated category payloads |
| Timeline projection duplicates authority | Correction/delete could show stale facts | Link every generated entry to record/version, keep one active per record, and rebuild idempotently from authority |
| Sync union expansion breaks older behavior | Child/emergency regressions or incompatible clients | Add compatibility tests, coordinated development boundary, and release-export containment |
| 500-record/2,000-Timeline scale target degrades | Vault/Timeline pagination may be unusable later | Add indexes, query-plan checks, deterministic cursor tests, and recorded target-scale measurements |

## Review Record

The plan was reviewed on 24 July 2026 against the roadmap definition of ready
and done, current executable OFF-04/OFF-05 patterns, ADR-0012, the core product,
architecture, backend-data-model, mobile-flow, migration, data-classification,
and testing sources.

Review findings incorporated before implementation:

1. Gate 2 conflict made the authorization boundary explicit and kept later M3
   packages blocked.
2. Product language listed caregiver entry as provenance while the accepted
   domain enum did not; actor membership now carries caregiver provenance.
3. Provider/government values existed without an issuer authority; consumer
   self-assertion is prohibited until a trusted adapter exists.
4. “All confirmed records” conflicted with nullable event dates; generated
   entries use an explicit confirmed-time fallback rather than inventing a
   clinical date.
5. Timeline ownership was ambiguous; one active generated projection per
   record/current version avoids a second authority and stale corrections.
6. VLT-01 did not justify a production record form; the native proof is
   development-only and VLT-02 retains UI ownership.
7. Immediate delete and hard purge were conflated; VLT-01 proves tombstone plus
   one queued purge request while retention/execution remains gated.
8. The general roadmap asks for physical iOS, but the requested matrix is
   physical Android plus iOS Simulator; completion evidence must preserve that
   bounded exception rather than claim the broader mobile gate.

Documentation validation and diff review must pass before this plan is treated
as finalized. Implementation begins only from this reviewed boundary.

## Follow-Up

- Close every remaining Gate 2 criterion before starting `VLT-02`.
- Add the production accessible manual record, correction, history, and delete
  experience in `VLT-02`.
- Add capture/import, files, uploads, OCR, and suggestion review only in their
  ordered packages.
- Define approved retention/purge durations before real data.
- Implement issuer registry, signatures, and trusted provider/government
  adapters before exposing verified provenance.
- Complete physical iOS, target low-end Android, two-physical-device, and full
  assistive-technology evidence at their named gates.

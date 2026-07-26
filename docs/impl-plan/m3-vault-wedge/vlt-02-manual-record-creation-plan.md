# VLT-02 Manual Record Creation Plan

> **Status:** Complete
> **Plan state:** Reviewed, validated, and finalized for implementation
> **Started date:** 2026-07-24
> **Last updated:** 2026-07-24
> **Completion date:** 2026-07-24
> **Owner:** Engineering
> **Milestone:** M3
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
> **Roadmap:** [M3 Vault Wedge](../roadmap.md#m3--vault-wedge)

---

## Outcome

An enrolled parent can use production mobile routes to save and resume an
encrypted local manual-record draft, explicitly confirm it as a document,
vaccination, doctor-visit, or prescription record, inspect the optimistic or
synced result, correct it through an immutable version, inspect available
version history, and delete it through the accepted tombstone flow.

The flow remains useful offline after enrollment. Confirmation creates exactly
one ordered record mutation and local Timeline projection; reconnection or a
manual retry synchronizes it through the accepted OFF-04/VLT-01 engine. Every
field that the planned extraction flow may later suggest has a manual entry
path, but VLT-02 performs no capture, OCR, AI, scheduling, search, or medical
inference.

## Authorization And Gate Boundary

Gate 2 remains open. Founder direction on 24 July 2026 explicitly authorizes
this bounded VLT-02 package to proceed after its plan is reviewed, validated,
and finalized.

This exception:

- authorizes only VLT-02 manual record creation and its required
  create/view/correct/history/delete experience;
- does not close Gate 2 or authorize VLT-03 and later M3 packages;
- does not replace missing two-physical-device, low-end Android, complete
  assistive-technology, or physical-iOS evidence;
- does not permit real child, parent, clinical, document, provider, or
  government data; and
- does not broaden live-provider, production-deployment, signed-distribution,
  pilot, or real-data claims.

## Scope

- Extend the accepted `RecordVersionContentV1` discriminated union with bounded
  `document.v1`, `vaccination.v1`, `doctor_visit.v1`, and `prescription.v1`
  detail payloads.
- Keep title, event/document date, provider/facility, notes, child, category,
  provenance, confirmation, access scope, revision, and version behavior on
  the VLT-01 aggregate.
- Add category-specific manual fields:
  - document kind;
  - vaccine name, entered-date meaning, and optional batch/lot;
  - visit reason, optional follow-up date, and tags;
  - medicines as parent-confirmed text, written schedule/instructions, and
    optional duration/end date.
- Use explicit `notProvided` versus `confirmed` state for optional text/date
  fields. Empty text never means “none,” “not applicable,” or “confirmed.”
- Validate normalized dates, bounds, category/detail agreement, title, and
  category safety rules in the framework-independent domain package and shared
  contracts.
- Add SQLCipher schema V5 for encrypted, resumable form drafts. Drafts are
  local-only and never enter sync, Timeline, audit, or confirmed history.
- Add local repository operations to save/read/list/delete drafts, list current
  manual records, confirm a draft atomically into the ordered mutation queue,
  correct a confirmed record, read/cache history, and queue deletion.
- Build production Expo Router routes for:
  - the bounded manual-record management entry point;
  - new manual record;
  - current record detail;
  - correction;
  - available version history.
- Reuse semantic tokens and foundation primitives, add domain components only
  where the production record routes consume them, and support narrow phones,
  dynamic text, high contrast, screen readers, and minimum touch targets.
- Show textual draft, local-only, pending, synced, rejected, conflict, deleted,
  date-authority, provenance, and offline/retry states without relying on color.
- Require explicit confirmation before creating a confirmed record, correcting
  a record, discarding a draft, or deleting a record.
- Attempt foreground synchronization after a confirmed action when possible,
  while treating a safely queued offline result as success and exposing a
  manual retry.
- Fetch and cache authorized version history when online; preserve already
  cached history offline.
- Reuse the VLT-01 development-only synthetic session boundary to exercise the
  production editor/detail/history components on physical Android and iOS
  Simulator without real data.
- Add focused domain, contract, SQLCipher migration/repository, mobile
  presentation/workflow, API/sync, PostgreSQL, release-containment, privacy,
  and regression tests.
- Create an implementation evidence dossier and align the dashboard, roadmap,
  M3 index, repository index/context map, ADR-0014 review, core implementation
  labels where affected, and validation records.

## Out Of Scope

- Camera, scanner, gallery, file/PDF picker, share sheet, source previews,
  attachments, or interrupted capture (`VLT-03`).
- File encryption, upload/download, object storage, thumbnails, malware checks,
  or worker processing (`VLT-04`, `VLT-05`).
- OCR, suggested fields, AI processing, confidence, source spans, model calls,
  or processor consent (`VLT-06`, `UTL-08`).
- Vaccination schedules, due-state generation, reminders, overdue labels,
  medication completion/discontinuation, or clinical interpretation
  (`VLT-07`, `UTL-01`).
- Search, filters, full Vault hierarchy, pagination, FTS, recent-record ranking,
  attachment retrieval, or production Timeline browsing (`VLT-08`).
- Duplicate detection, merge, file failure recovery, disk-pressure capture
  behavior, or generic conflict-resolution UI (`VLT-09`).
- Provider/government ingestion, trusted issuer selection, verification
  badges, signatures, interoperability, or official-record claims.
- Archive/restore UI, hard purge execution, retention-duration selection,
  sharing/export, arbitrary ACLs, or staff access.
- Background synchronization while SQLCipher is locked.
- Multi-child selection. The accepted MVP enrollment currently provides one
  active child; later household expansion must add an explicit selector.
- Real data, live identity/provider credentials, signed store distribution,
  physical iOS, or Gate 2/pre-pilot closure.

## Source Traceability

| Requirement | Source |
| --- | --- |
| Package scope and order | Roadmap Sections 12 and 25 |
| Manual forms, draft/sync behavior, correction/history/delete routes | Mobile application flow Sections 9–20 and 24 |
| Manual entry and launch extraction fields | Product plan Sections 14.4–14.7 and 27.2–27.3 |
| Generic record/version/provenance/Timeline boundary | ADR-0014 and VLT-01 plan/evidence |
| Server authority, conflict, reset, and unlocked-only sync | ADR-0012 |
| Encrypted content and local key custody | Architecture Sections 13–15, ADR-0010, ADR-0011 |
| Reviewed forward-only migrations | ADR-0005 and database migration guidance |
| Privacy-safe telemetry and synthetic-only evidence | ADR-0007 and engineering data classification |

## Dependencies

- Accepted VLT-01 record aggregate, encrypted immutable versions, generated
  Timeline projection, read/history routes, sync variants, SQLCipher V4
  repository, delete tombstone, and development-device harness.
- `FND-04` contracts/domain kernel, `FND-05` database foundation, `FND-07`
  privacy-safe observability, and `FND-08` semantic UI foundations.
- `OFF-01` through `OFF-05` session, household, consent, local security,
  repository, synchronization, and emergency-card boundaries.
- Node.js 24.18.0, pnpm 11.14.0, ignored local `.env.aiven`, disposable Aiven
  PostgreSQL, a connected physical Android device, and an installed iOS
  Simulator development client.

## Reviewed Decisions

1. **Extend the existing content union.** Four category payloads extend
   `RecordVersionContentV1`; no category table, API, mutation queue, or
   synchronization engine is duplicated.
2. **Keep later extraction fields manually reachable.** Common and
   category-specific fields cover document date, provider, category, vaccine
   name/date meaning, medicine/written schedule, follow-up date, and notes.
   Child match is not a manual health value: the one active child is selected
   from the authorized local repository.
3. **Do not pull VLT-07 behavior forward.** VLT-02 records a parent-entered
   vaccination date meaning (`due` or `given`) and literal medicine
   instructions. It does not generate schedules, reminders, overdue states,
   dosage, diagnoses, or medication advice.
4. **Drafts are form artifacts, not records.** SQLCipher V5 stores category,
   child, bounded form values, target record when correcting, and update time.
   Drafts have no provenance, revision, Timeline row, mutation, or server
   authority until explicit confirmation.
5. **Confirmation is atomic locally.** The local repository queues one
   idempotent create/correction, writes the optimistic current projection and
   generated Timeline projection, and removes the source draft in one
   transaction.
6. **All VLT-02 provenance is manual.** The client cannot select imported,
   OCR-assisted, AI-assisted, provider-issued, or government-imported
   provenance in a manual form.
7. **Correction replaces the full bounded content version.** Editing starts
   from the current version, preserves the original category and record ID,
   appends a new immutable server version, and never edits historical rows.
8. **History is cache-first.** Current versions already received through sync
   remain readable offline. An online history refresh uses the VLT-01
   authorized endpoint and caches immutable versions in SQLCipher.
9. **The index is not VLT-08.** VLT-02 adds only the smallest local,
   child-scoped management list needed to re-open records created by this
   package. Search, filters, ranking, pagination, and the final Vault
   information architecture remain deferred.
10. **Deletion uses the existing logical-delete boundary.** The UI explains
    immediate removal, synchronization, and exported-copy limits; it does not
    promise hard-purge timing.
11. **Queued offline confirmation is a valid local outcome.** The UI says
    “saved on this device” until sync succeeds. It never presents a network
    failure as loss or a pending write as server-confirmed.
12. **No production dependency is added.** Existing Expo, Router, React Query,
    domain, contract, local-security, repository, and design-system
    foundations are sufficient.

## Data And Trust Review

| Data | Classification | Treatment |
| --- | --- | --- |
| Draft ID, record ID, child ID, category, target relation, update time | Sensitive/internal | SQLCipher only; IDs never analytics |
| Draft title, provider, notes, vaccine, batch, visit reason, tags, medicines, schedule, dates | Restricted child/health | SQLCipher form JSON; no server/audit/Timeline before confirmation |
| Confirmed content | Restricted child/health | VLT-01 household envelope in PostgreSQL plus SQLCipher cache |
| Category, event time, revision, sync state | Internal/health-adjacent | Minimum queryable metadata required by accepted record/sync behavior |
| Mutation/request IDs and outcome codes | Operational | Bounded metadata only; no form values |

- The production UI must never log, analyze, or report field values, dates,
  record/child IDs, titles, providers, medicines, or notes.
- Owner/caregiver capability checks remain server derived. The client UI is not
  an authorization boundary.
- Manual confirmation relies only on accepted child-data-processing consent.
  No vision, AI, provider, or third-party processing consent is exercised.
- Sign-out risk accounting must include unsynchronized confirmed mutations.
  Local-only drafts are wiped with the SQLCipher database and are never silently
  uploaded.

## Module Status

| Module | Status | Notes |
| --- | --- | --- |
| Plan and authorization boundary | Completed | Reviewed against roadmap, core sources, ADRs, VLT-01 behavior, and current code |
| Domain/category payload policy | Completed | Four bounded schemas and safety validation passed |
| Contracts/generated OpenAPI | Completed | Shared and generated schemas cover all four categories and schema V5 |
| SQLCipher schema V5 and draft repository | Completed | Encrypted local drafts and atomic draft confirmation passed |
| Production record mobile routes/components | Completed | Create, view, correct, history, delete, status, and retry implemented |
| API/sync/PostgreSQL integration | Completed | VLT-01 persistence reused; all four categories passed disposable Aiven checks |
| Automated and release validation | Completed | 206 root tests, validation, builds, exports, and clean checkout passed |
| Android and iOS Simulator evidence | Completed | Complete synthetic lifecycle passed on Pixel 8 and iPhone 17 Pro Simulator |
| Documentation and evidence | Completed | Dashboard, roadmap, indexes, ADR review, plan, and evidence aligned |

## Implementation Plan

1. Add domain types and validation for the four category detail schemas,
   optional confirmed dates, date meaning, string bounds, normalized dates,
   category/detail agreement, and VLT-02 safety constraints.
2. Extend Zod/shared sync/OpenAPI content schemas and regenerate committed
   OpenAPI JSON/types. Add positive and rejection contract cases for every
   category.
3. Add SQLCipher migration V5 with `local_record_drafts`, indexes, marker
   compatibility, migration tests, upgrade tests, and wipe coverage.
4. Extend the local repository with draft CRUD, manual-record listing,
   atomic draft confirmation, history caching, and explicit deletion behavior.
   Preserve pending/conflict/reset/tombstone rules from VLT-01.
5. Add pure mobile form mapping/validation/presentation helpers and tests before
   building screens.
6. Build reusable production components for category choice, common fields,
   category fields, safety copy, sync/provenance/status summaries, destructive
   confirmation, and history rows.
7. Add Expo Router routes for the manual-record entry point, new draft, detail,
   correction, and history. Wire the landing screen and route titles.
8. Add a foreground synchronization adapter that uses current household
   enrollment, optional development-only validation headers, the existing
   React Query boundary, and safe queued/offline messages.
9. Extend the VLT-01 synthetic device harness only as needed to drive the
   production VLT-02 components and prove create/draft/restart/sync/correct/
   history/delete on physical Android and iOS Simulator.
10. Extend PostgreSQL integration to create and correct every category and
    assert one aggregate/version/active Timeline projection per confirmed
    action, manual provenance, no plaintext canaries, idempotency, and delete
    tombstones.
11. Run focused tests and generated-output checks; fix all regressions before
    broader validation.
12. Run root unit/contract/database/build/validate/clean-checkout gates and
    inspect release bundles for development-validation and sensitive canaries.
13. Perform bounded device acceptance on the connected physical Android device
    and iOS Simulator, capturing exact OS/device, app/API/database boundary,
    flow steps, accessibility states, offline/restart behavior, and residual
    limitations.
14. Create the VLT-02 evidence dossier, review the final diff, align the plan,
    ADR-0014, indexes, context map, dashboard, roadmap, and affected core
    implemented/planned labels, and mark complete only if every required row
    passes.

## Acceptance Criteria

- Each of document, vaccination, doctor visit, and prescription can be manually
  entered with category-appropriate parent-friendly fields and safety copy.
- Every planned extraction field has a manual path or a documented non-field
  equivalent (authorized active child selection).
- Invalid/blank/oversized values, invalid dates, category/detail mismatch, and
  ambiguous vaccination date meaning are blocked without losing other input.
- A draft survives route exit and process restart in SQLCipher without creating
  a record, version, Timeline entry, mutation, or server write.
- Discard requires explicit confirmation and removes only the selected draft.
- Confirm creates one pending local record and Timeline projection, removes the
  draft atomically, and remains usable offline.
- Reconnection/manual retry applies one authoritative create; replay remains
  idempotent.
- Detail shows category, title, effective-date meaning, provider, all confirmed
  fields, manual provenance, current version, and textual sync status.
- Correction begins with current content, queues with the current base
  revision, preserves the original offline, appends one authoritative version,
  and updates the active Timeline projection after sync.
- History displays cached immutable versions offline and refreshes authorized
  history online without mutating it.
- Delete requires explicit confirmation, removes the record/Timeline locally,
  synchronizes one tombstone/purge request, and does not promise hard-purge
  completion.
- Safe rejection/conflict/offline states preserve editable local work and do
  not expose content in logs, analytics, errors, or development evidence.
- Production routes and release exports contain no synthetic validation
  credentials or device-validation content.
- Focused, root, database, build/export, docs, clean-checkout, physical Android,
  and iOS Simulator checks pass within the recorded boundary.
- Documentation does not claim Gate 2, physical iOS, two-device, low-end
  Android, real-provider, real-data, later-M3, pilot, or production completion.

## Validation

### Planning gate

- `./scripts/context/validate-docs.sh`
- `pnpm check:format`
- Plan diff review against roadmap, product, architecture, data model, mobile
  flow, ADR-0012, ADR-0014, VLT-01 implementation, and current tests

Implementation may begin only after this planning gate passes.

### Focused automated validation

- `pnpm --filter @littlearc/domain test`
- `pnpm --filter @littlearc/contracts test:contract`
- `pnpm --filter @littlearc/mobile test`
- `pnpm --filter @littlearc/api test`
- `pnpm check:generated`
- `pnpm check:design-system`

### Database and integration validation

- `pnpm test:database:record`
- `pnpm test:database:sync`
- `pnpm test:database:household`
- `pnpm test:database:rls`

Database evidence must use disposable synthetic fixtures on the configured
local Aiven service. It must not be described as Railway staging/production or
real-data evidence.

### Broader repository validation

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm validate`
- `./tooling/validate-clean-checkout.sh`

### Device and simulator validation

Physical Android and iOS Simulator functional evidence must each cover:

1. bootstrap one synthetic owner/child and enroll/unlock SQLCipher;
2. save a partially completed draft while the API is unavailable;
3. leave/reopen or terminate/restart and resume the exact draft;
4. verify invalid required input remains blocked and announced textually;
5. confirm each of the four categories through the production editor;
6. verify pending/local-only detail and Timeline state offline;
7. reconnect and synchronize each record exactly once;
8. inspect a synced record, correct it, and synchronize a new immutable version;
9. inspect version history online, restart, disable the API, and inspect cached
   history offline;
10. delete one record with explicit confirmation, synchronize, and verify the
    local record/Timeline tombstone outcome;
11. expose textual non-color results and native semantic labels through the
    production components; and
12. inspect process logs for seeded sensitive canaries and record exact
    limitations.

The physical-Android result is one-device evidence. Any simulated remote writer
does not become two-device evidence. iOS Simulator does not become physical-iOS
or Secure Enclave evidence. A separate 200% text and complete
TalkBack/VoiceOver walkthrough remains a Gate 2 accessibility obligation and
requires approval before changing physical-device accessibility settings.

## Evidence

Passing implementation and bounded device evidence is recorded in the
[VLT-02 evidence dossier](./vlt-02-implementation-evidence.md).

## Risks And Blockers

| Risk or blocker | Impact | Control / resolution |
| --- | --- | --- |
| Gate 2 remains open | General M3 breadth is not ready | Keep the package-specific authorization explicit; do not start VLT-03+ |
| Product fields can pull VLT-07 behavior forward | Unsafe scope and medical claims | Store literal parent-confirmed values only; no schedules, inference, dosage, reminders, or advice |
| Local draft is mistaken for authoritative record | Timeline/search/reminder leakage | Separate V5 draft table; no mutation/provenance/version until explicit confirmation |
| Correction overwrites current content | Provenance/history loss | Full replacement creates a new immutable version through VLT-01 |
| Management list drifts into VLT-08 | Search/Vault scope expansion | Child-scoped local list only; no search, filters, pagination, or ranking |
| Network failure is shown as failed save | Parent may retry and duplicate | Treat atomic local queue success as saved-on-device; sync is a separate state |
| Delete copy overpromises purge | Trust and policy error | Describe immediate app removal and queued server deletion only |
| Physical iOS is unavailable/request excludes it | Broader mobile gate cannot be claimed | Accept iOS Simulator only and retain physical-iOS obligation |
| Complete low-end/assistive matrix remains unproven | Gate 2 stays open | Record only the requested Pixel/Simulator checks; retain named gate work |
| Existing validation session is development-only | Could leak to release | Keep wiring behind development route and pass release-bundle containment checks |

## Plan Review And Finalization

The plan was reviewed against the delivery dashboard, roadmap, M3 index,
product plan, architecture, backend data model, mobile application flow,
ADR-0012, ADR-0014, the complete VLT-01 plan/evidence, and current domain,
contract, PostgreSQL, API, SQLCipher, sync, and mobile implementations.

Review findings incorporated before implementation:

1. The prior VLT-01 exception explicitly blocked VLT-02; the new founder
   direction is recorded as a separate bounded authorization without claiming
   Gate 2 closure.
2. The roadmap named four forms but not an exact category payload. This plan
   maps only source-backed manual/extraction fields and retains a review of
   ADR-0014 because adding the second category schema triggers it.
3. Vaccination and prescription requirements risked importing schedule and
   medication behavior. The plan limits VLT-02 to literal, parent-confirmed
   facts and defers behavior to VLT-07/UTL-01.
4. “Save local drafts offline” was ambiguous against VLT-01 confirmed
   optimistic records. The plan separates draft artifacts from authoritative
   record mutations and requires atomic draft-to-confirmed transition.
5. “View” could imply the full Vault. The plan adds only the minimum local
   management list and record routes; VLT-08 retains Vault/search ownership.
6. Existing VLT-01 validation was development-only while VLT-02 owns production
   UI. Device acceptance therefore reuses production components with
   development-only synthetic session plumbing and verifies release
   containment.
7. The requested device matrix is physical Android plus iOS Simulator. Evidence
   must preserve that boundary and leave physical iOS, two-device, low-end, and
   complete assistive-technology criteria open.

Documentation validation and plan-diff review passed before implementation.
The final implementation also passed the linked automated, database, release,
physical-Android, and iOS-Simulator evidence.

## Follow-Up

- Close every remaining Gate 2 criterion independently; VLT-02 completion does
  not close the gate.
- Add capture/import and source preservation in VLT-03.
- Add encrypted file transport and worker validation in VLT-04/VLT-05.
- Add suggestions/OCR review in VLT-06 using the same manual fields.
- Add vaccination/visit/prescription behavior, reminders, and safety-approved
  terminology in VLT-07.
- Add full Vault/search/retrieval in VLT-08 and duplicate/failure handling in
  VLT-09.
- Define approved retention/purge durations before real data.
- Complete pediatric terminology/safety, privacy/legal, and security specialist
  reviews before real-data or pilot claims.

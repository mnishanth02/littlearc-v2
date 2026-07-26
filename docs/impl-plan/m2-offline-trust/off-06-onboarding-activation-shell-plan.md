# OFF-06 Onboarding Activation Shell

> **Status:** Complete
> **Started date:** 23 July 2026
> **Completed date:** 23 July 2026
> **Last updated:** 23 July 2026
> **Owner:** Engineering
> **Milestone:** M2
> **Work package:** `OFF-06`
> **Depends on:** Accepted Gate 1 and completed `OFF-01` through `OFF-05`
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
> **Inputs:** [roadmap](../roadmap.md),
> [product plan](../../core/littlearc-complete-product-plan.md),
> [mobile flow](../../core/mobile-application-flow.md),
> [architecture](../../core/littlearc-architecture-and-tech-stack.md),
> [design system](../../core/design-system.md),
> [authentication decision](../../adr/0009-consumer-authentication-and-session-boundary.md),
> [household and consent decision](../../adr/0010-household-membership-encryption-and-consent-boundary.md),
> [local-security decision](../../adr/0011-local-key-custody-app-lock-and-device-enrollment.md),
> [synchronization decision](../../adr/0012-server-authoritative-synchronization-and-conflict-boundary.md),
> and [emergency-card decision](../../adr/0013-emergency-card-aggregate-and-standard-access-boundary.md)

---

## Outcome

A prospective owner can move through one coherent, accessible activation shell
that explains LittleArc's value and privacy boundary, confirms the existing
account/session checkpoint, records the required parent and child-data
consents, creates the owner household and child, enrolls the device, creates
and synchronizes the emergency card, and reaches an explicitly synthetic
first-record preview. The shell reports only coarse allowlisted funnel
milestones, keeps optional profile questions progressive, and never treats the
M3 preview as a real record or as seven-day activation.

## Scope

- Add an Expo Router onboarding stack and reusable activation-shell component
  for the value/privacy promise, account checkpoint, required consent, child
  basics, emergency basics, first-record preview, and completion summary.
- Compose the accepted OFF-01 session, OFF-02 atomic owner-onboarding command,
  OFF-03 device enrollment/SQLCipher boundary, and OFF-04/OFF-05 emergency-card
  repository and synchronization path. Do not add a second persistence or sync
  channel.
- Keep pre-household shell state in memory. Submit the required parent,
  consent, and child values through the existing all-or-nothing,
  idempotent `POST /v1/households/onboarding` operation. A process restart
  before submission safely restarts the shell instead of persisting sensitive
  drafts outside the reviewed encrypted model.
- Use required synthetic parent, child, contact, and medical fixtures for
  automated and physical-device evidence while real participant and child data
  remains blocked.
- Make optional emergency values progressive and explicit. Preserve
  `notProvided`, applicable `noneConfirmed`, and confirmed states; require one
  synthetic guardian contact for the accepted emergency-card aggregate.
- Add a feature-labelled first-record preview that writes no record, file,
  mutation, audit, analytics identifier, or activation credit before M3.
- Extend the compile-time analytics allowlist with one bounded onboarding
  milestone event. Properties may contain only milestone, outcome, and
  platform enums—never user, household, child, card, record, contact, date,
  health, route-resource, free-text, or provider values.
- Add a development-only end-to-end Android route and disposable Aiven
  PostgreSQL harness for the complete composed flow.

## Out of Scope

- New authentication methods, live provider verification, recovery, or
  organization-owned credentials. The shell consumes OFF-01 and uses only a
  named synthetic session in the device harness.
- A new onboarding draft table, partial child creation, plaintext local
  storage, or persistence in TanStack Query, AsyncStorage, analytics, or route
  parameters.
- Real record/file creation, capture, import, OCR, review, reminders,
  notification permission, or seven-day activation. These remain owned by M3
  and later packages.
- Optional AI/vision consent. It stays separate and off.
- OS-level locked emergency quick access, share/export, caregiver invitations,
  multiple children, or multiple household membership.
- Real parent, participant, child, contact, medical, or document data;
  production distribution; physical iOS; two physical devices; or real
  provider evidence.
- Gate 2 closure. OFF-06 can prove the composed physical-Android and
  iOS-Simulator development-client flows, but two-device conflict,
  physical-iOS, complete assistive-technology/low-end coverage, and all other
  named criteria retain their existing gates.

## Dependencies and Constraints

- OFF-01 owns account/session establishment. The activation shell confirms an
  authenticated checkpoint; it does not store identity secrets or reproduce
  provider UI.
- OFF-02 owns adult-verification injection, notice versions, atomic
  household/member/parent/child/consent creation, RLS, encrypted server
  payloads, audit, and idempotency.
- OFF-03 owns strong-biometric capability, protected key custody, SQLCipher
  enrollment, recovery, and verified wipe.
- OFF-04 owns PostgreSQL-authoritative synchronization, signed cursors,
  snapshots, mutation ordering, retries, resets, and conflicts.
- OFF-05 owns emergency-card domain semantics, encrypted immutable versions,
  SQLCipher schema V3, standard post-unlock access, and the production card UI.
- Only semantic design tokens and accepted foundation primitives may style the
  shell. It must remain usable at narrow width, 200% dynamic type, dark/high-
  contrast themes, and reduced motion.
- Only synthetic fixtures are permitted until every named pre-real-data gate
  passes.

## Reviewed Decisions

1. **Composition, not replacement.** OFF-06 adds a mobile orchestration and
   presentation boundary. It does not change the accepted server schema,
   enrollment policy, local schema, synchronization protocol, or
   emergency-card aggregate.
2. **Atomic create remains atomic.** Required parent, consent, and child data
   are reviewed across progressive screens but submitted through the existing
   OFF-02 atomic command. No partial child is created, and an exact retry keeps
   its idempotency semantics.
3. **Safe restart before creation.** Pre-submit values stay in React memory.
   Until a reviewed encrypted onboarding-draft lifecycle exists, process death
   restarts the pre-create shell rather than leaving sensitive draft fragments.
4. **Account and adult verification stay bounded.** Production integration
   requires an OFF-01 session and the approved adult-verification port. The
   device harness may inject only its named synthetic identity and synthetic
   approval; neither result is persisted as provider evidence.
5. **Emergency creation reuses shared sync.** After owner creation and device
   enrollment, the shell queues one emergency-card mutation in SQLCipher and
   runs the OFF-04 coordinator. The server's accepted encrypted version is the
   completion condition.
6. **First record is a preview, not a lie.** Before M3, the shell displays a
   fixed synthetic document preview and records only the coarse milestone that
   the preview was reached or skipped. It creates no record and does not claim
   activation.
7. **One coarse event shape.** `onboarding_milestone_reached` uses bounded
   milestone, outcome, and platform enums. The allowlist rejects extra fields,
   free text, sensitive canaries, resource identifiers, and unknown
   milestones. Delivery remains disabled by default.
8. **One reusable step model.** The production shell and development-only
   physical validation route share the same ordered step definition,
   accessibility labels, progress semantics, and completion rules so the
   device proof exercises the shipped interaction rather than a parallel
   checklist.

## Module Status

| Module | Status | Notes |
| --- | --- | --- |
| Plan and boundary review | Completed | Source traceability, scope, privacy, composition, synthetic-data, analytics, documentation, source-coverage, and diff reviews passed on 23 July 2026. |
| Workflow and analytics | Completed | Typed ordered workflow, completion rules, strict coarse milestone allowlist, and rejection/canary tests passed. |
| Mobile activation shell | Completed | Shared seven-step shell, synthetic summaries, preview, completion, progress semantics, safe retry states, and development-versus-release route containment passed. |
| Composed API/native harness | Completed | Disposable Aiven mode composed atomic owner create, protected enrollment, SQLCipher repository, and shared authoritative synchronization. |
| Automated and device validation | Completed | Focused, database, repository, build/export, release-bundle canary, root, clean-checkout, Pixel 8, iOS Simulator, accessibility, failure/retry, restart/offline, and leakage checks passed within the recorded boundary. |
| Documentation and evidence | Completed | Evidence dossier and the plan, M2 index, context map, dashboard, roadmap, and repository index are aligned. |

## Implementation Plan

1. Finalize this plan through source coverage, dependency-boundary review,
   documentation validation, and diff review. Start implementation only after
   the plan is marked `In Progress`.
2. Add a pure typed onboarding workflow with ordered milestones, safe
   transitions, progress calculation, completion requirements, retryable
   failure state, and explicit first-record preview semantics.
3. Add `onboarding_milestone_reached` to the observability allowlist. Accept
   only bounded milestone, outcome, and platform properties. Extend rejection,
   disabled-delivery, and sensitive-canary tests.
4. Build a reusable `OnboardingActivationShell` using Expo Router, semantic
   Unistyles tokens, scroll-safe layout, accessible progress/status
   announcements, plain-language privacy copy, progressive optional choices,
   explicit consent actions, and deliberate retry/skip controls.
5. Add the onboarding stack and route integration. Keep the route free of
   components or business logic; inject the composed activation adapter from
   `src/onboarding`.
6. Implement the composed synthetic activation adapter for device evidence:
   confirm the named session boundary, execute the existing idempotent owner
   onboarding request, enroll the device, initialize SQLCipher, synchronize the
   child projection, queue the emergency card through the accepted repository,
   synchronize its authoritative version, and verify the local confirmed read.
7. Extend the disposable Aiven integration harness with a named OFF-06
   device-validation mode. It starts with an empty synthetic identity, exposes
   only the existing owner/device/sync routes plus a bounded bootstrap/evidence
   endpoint, and verifies exactly one household, child, required consent set,
   device, emergency card/version, and minimized evidence.
8. Add focused tests for workflow order, invalid transition rejection,
   completion requirements, progressive optional states, analytics properties,
   adapter error mapping, and no record/identifier emission.
9. Run focused tests first, then Aiven integration, generated-output drift
   twice, root tests/build/validation, Expo Doctor, Android/iOS exports,
   clean-checkout proof, and diff/privacy review.
10. Drive the complete shared shell on the connected physical Android device
    with fixed synthetic values. Verify progress, account/consent/child
    checkpoints, biometric enrollment, emergency-card authoritative sync,
    synthetic first-record preview, completion summary, process restart/local
    card read, 200% text, dark/high-contrast presentation, TalkBack semantics
    where available, and logcat leakage/fatal-error absence.
11. Run the same shared shell in an iOS custom development client. Verify
    simulated Face ID, exact disposable Aiven evidence, API-down safe retry,
    accessibility content sizing, process restart, and API-offline SQLCipher
    read without presenting simulator security as physical-iPhone evidence.
12. Create the implementation evidence dossier and align the M2 README,
    context map, repository index, dashboard, and roadmap. Mark OFF-06 complete
    only if its implementation and required Android evidence pass; leave Gate
    2 and its wider obligations explicitly open.

## Acceptance Criteria

- The shared shell exposes the ordered promise, account, consent, child,
  emergency, first-record-preview, and completion states with accurate progress
  and accessible names. Invalid or duplicate transitions cannot skip required
  checkpoints.
- Required consent and child creation use the current OFF-02 notice versions
  and atomic endpoint. Failure or exact retry produces no partial or duplicate
  household, member, profile, child, consent, audit, change, outbox, key, or
  idempotency evidence.
- The shell does not persist pre-submit parent or child drafts in plaintext
  storage, route parameters, query cache, logs, or analytics.
- Device enrollment uses OFF-03 protected custody. The emergency card is queued
  in SQLCipher and synchronized through OFF-04/OFF-05; no parallel HTTP-only
  emergency write or second local store is introduced.
- Completion requires an authoritative synchronized emergency-card version.
  Optional blood group, allergy, medicine, note, and pediatrician values remain
  progressive and structurally distinguish unknown from none confirmed.
- The first-record step is visibly synthetic/feature-labelled, creates no
  record/file/mutation/server evidence, and cannot be presented as a real
  record, first-record completion, or seven-day activation.
- Analytics accepts only the approved onboarding event and bounded properties.
  It rejects identifiers, dates, free text, extra fields, unknown milestones,
  and seeded sensitive canaries; runtime delivery stays disabled by default.
- Retry states preserve safe shell context without exposing payloads. Errors
  use stable support-safe copy rather than server, key, child, contact, or
  medical values.
- Focused tests, real Aiven PostgreSQL integration, root tests, typechecks,
  Android/iOS exports, Expo Doctor, generated-output drift, documentation,
  clean-checkout validation, and final diff/privacy review pass.
- The physical Android flow completes from a clean synthetic identity through
  the shared shell, device enrollment, SQLCipher-backed emergency sync, preview,
  completion, and process-restart emergency-card read. Evidence records device,
  Android/build, synthetic boundary, accessibility settings, and logcat review.
- Completion is not reported as physical iOS, two-device, live-provider,
  real-data, real-record/reminder, locked quick-access, full assistive-
  technology, or Gate 2 closure evidence.

## Validation

- `pnpm --filter @littlearc/observability test`
- `pnpm --filter @littlearc/mobile test`
- `pnpm --filter @littlearc/mobile typecheck`
- `pnpm --filter @littlearc/api test`
- `pnpm test:database:household`
- `pnpm test:database:sync`
- `pnpm test:database:emergency-card`
- `pnpm check:generated` twice
- `pnpm test`
- `pnpm build`
- `pnpm validate`
- `pnpm --filter @littlearc/mobile run doctor`
- `pnpm --filter @littlearc/mobile build:android`
- `pnpm --filter @littlearc/mobile build:ios`
- `./tooling/validate-clean-checkout.sh`
- `pnpm check:docs`
- `git diff --check`
- Connected physical-Android OFF-06 synthetic activation flow, 200% text,
  dark/high-contrast, TalkBack semantics where available, process restart,
  emergency-card local read, screenshot/UI hierarchy, and logcat review.
- iOS Simulator custom-development-client OFF-06 flow, simulated Face ID,
  API-down safe retry, accessibility content sizing, exact Aiven counts,
  process restart, and API-offline SQLCipher read.

## Risks and Blockers

| Risk or blocker | Control | Resolution trigger |
| --- | --- | --- |
| Shell duplicates OFF-01–05 policy or persistence | Keep a typed orchestration adapter; call accepted commands/repositories. | Focused boundary tests and diff review show no parallel path. |
| Progressive screens imply partial durable child creation | Keep pre-submit state in memory and submit one OFF-02 atomic command. | A reviewed encrypted draft lifecycle is approved later. |
| Synthetic preview is mistaken for a real record or activation | Label it on screen and in evidence; create no record/mutation; keep event outcome `previewed`/`skipped`. | M3 record creation and activation metrics are implemented. |
| Funnel telemetry leaks identity or health context | One strict event shape, delivery off by default, canary/extra-field rejection. | BTA-05 later approves delivery and environment separation. |
| Device proof overclaims Gate 2 | Report physical Android and iOS Simulator separately; keep physical-iOS, two-device, and wider criteria open. | Every named Gate 2 criterion passes on its required matrix. |
| Physical device lacks strong biometrics or usable accessibility setup | Inspect before testing; report unavailable checks separately. | Required device settings/capability become available. |

## Evidence

Accepted implementation evidence is recorded in
[off-06-implementation-evidence.md](./off-06-implementation-evidence.md).

## Follow-up

- M3 owns real record/file persistence, capture/import/manual flows, first
  reminder, and meaningful activation credit.
- BTA-05 owns analytics delivery, deduplication, offline delivery,
  installation identifiers, and environment separation.
- Gate 2 retains two physical devices, physical iOS, full
  accessibility/low-end coverage, and every other named criterion not covered
  by the bounded physical-Android plus iOS-Simulator run.
- Pre-pilot gates retain real providers, real data, store distribution,
  recovery ownership, legal/privacy/security approval, and the broader
  physical-device matrix.

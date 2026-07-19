# LittleArc Implementation Plan and Roadmap

> **Status:** Accepted execution baseline — see the [Implementation Status Tracker](../IMPLEMENTATION_STATUS.md) for live delivery state
> **Version:** 1.2
> **Last updated:** 18 July 2026
> **Product source:** [LittleArc Complete Product Plan](../core/littlearc-complete-product-plan.md)
> **Architecture source:** [LittleArc Architecture and Technology Stack](../core/littlearc-architecture-and-tech-stack.md)
> **Design-system source:** [LittleArc Design System](../core/design-system.md)
> **Delivery-status source:** [LittleArc Implementation Status Tracker](../IMPLEMENTATION_STATUS.md)
> **Audience:** Product, design, engineering, security, operations, QA, and implementation agents

---

## 1. Purpose

This document turns LittleArc's accepted product, architecture, and design-system
decisions into an execution plan for a greenfield implementation. It defines:

- The order in which the product should be built
- The workstreams that can proceed in parallel
- The dependencies that must remain sequential
- The outcomes and exit gates for each implementation phase
- The initial epic and work-package backlog
- The validation, security, privacy, release, and operational work required for
  a private beta and later public beta
- A repeatable method for planning each work package before implementation

This is a delivery-control document, not a replacement for the source
documents. Product behavior and scope remain authoritative in the product plan.
System boundaries and technical constraints remain authoritative in the
architecture document. Visual language and component intent remain
authoritative in the design-system document.

## 2. How to Use This Roadmap

The roadmap is deliberately organized from outcomes to implementation details:

1. Select the next milestone whose entry conditions are satisfied.
2. Pull the next work package from that milestone's ordered backlog.
3. Write or confirm the package brief using the template in Section 18.
4. Split the package into reviewable vertical slices.
5. Implement the smallest slice that proves the riskiest behavior.
6. Run the package verification and milestone gate.
7. Record decisions, evidence, and follow-up debt before starting the next item.

Work-package IDs such as `FND-03` and `OFF-04` are stable planning references.
They are not intended to become database IDs or permanent issue-tracker keys.

## 3. Source-of-Truth and Change Rules

### 3.1 Precedence

When documents appear to conflict, use this order:

1. Accepted, newer ADR for a specific technical decision
2. Product plan for product behavior, safety, scope, and validation policy
3. Architecture document for system structure and technical constraints
4. Design-system document for visual, accessibility, and component behavior
5. This roadmap for implementation order and delivery control
6. Individual issue or task notes

Do not silently resolve a meaningful conflict in implementation. Record it in
the decision log and update the affected source document or create an ADR.

### 3.2 Scope control

- Required MVP capabilities are planned into the roadmap.
- Should-have capabilities may enter only when their dependencies are already
  met and they do not threaten the current milestone gate.
- Could-have capabilities remain outside the committed path until private-beta
  evidence justifies them.
- Explicit MVP non-goals require a product-plan change before implementation.
- Billing remains deferred until the retention gate is met.
- Cloud AI remains optional, consented, feature-flagged, and downstream of a
  complete manual and on-device OCR path.

### 3.3 Treatment of the current design-system files

The existing token, theme, component, and reference-screen files are useful
design explorations, but they were created before the repository foundation and
are not yet an application scaffold. This roadmap therefore treats them as
**prototype inputs**, not production-ready foundations.

- Preserve them unchanged during planning and initial compatibility work.
- Do not build package or route assumptions around their current locations.
- Reconcile them in a dedicated work package after the monorepo, Expo app,
  TypeScript, Unistyles, and test foundations exist.
- Move or rewrite them only with a file-by-file adoption decision and visual,
  type, accessibility, and device verification.
- Preserve the semantic token intent and the "calm family utility with archival
  warmth" direction unless a design review changes it.

This separates design intent from accidental greenfield file structure.

## 4. Delivery Strategy

### 4.1 Build a walking skeleton before breadth

The first production-shaped slice should prove this complete path:

> Enroll a parent and device → create a child → store an encrypted emergency
> card locally → synchronize it through an authorized household API → reopen it
> offline → change it on a second device → resolve or display a conflict.

This slice crosses mobile, authentication, authorization, local encryption,
PostgreSQL, API contracts, synchronization, audit, observability, and testing.
It is intentionally narrower than the visible MVP but retires more risk than a
collection of disconnected screens.

### 4.2 Deliver vertical product increments

After the walking skeleton, each increment should include its full path:

- Product behavior and copy
- Accessible mobile interface
- Domain rules and validation
- Local persistence and offline behavior where required
- API contract and authorization
- Database migration and RLS policy
- Background jobs when required
- Analytics events through the allowlist
- Error and loading states
- Automated tests and operational diagnostics
- Privacy and security review proportional to the data involved

Avoid separate "frontend complete" and "backend complete" milestones that leave
critical behavior unintegrated.

### 4.3 Risk-first sequencing

The critical technical risks are addressed in this order:

1. Expo, New Architecture, Unistyles, and native-module compatibility
2. Reproducible local native builds and pilot distribution
3. SQLCipher, SecureStore, biometric invalidation, and offline recovery
4. Household authorization, RLS, session lifecycle, and audit
5. Server-authoritative sync, idempotency, conflicts, and tombstones
6. Encrypted document capture, resumable upload, and validation
7. On-device OCR and explicit confirmation
8. Reminder correctness and privacy-safe delivery
9. Export, deletion, backup, and restore
10. Consented cloud extraction and staff operations

### 4.4 Evidence before expansion

Product discovery, prototype testing, and concierge extraction tests run in
parallel with technical foundation work. They must refine record schemas,
onboarding, Smart Capture categories, and copy before those areas become costly
to change.

## 5. Planning Assumptions

### 5.1 Team assumption

The baseline plan assumes a focused team with:

- One product/founder lead
- One product designer/researcher
- Two React Native engineers
- One backend/platform engineer
- One QA/automation engineer, full-time or substantial part-time
- Fractional security, privacy/legal, pediatric, and operations support

With one mobile engineer and one backend engineer, retain the same order but
expect less overlap and a longer calendar duration.

### 5.2 Schedule assumption

The product plan's **19–23 week** target from discovery to hardened external
beta remains the baseline planning envelope for the stronger team. It requires
overlap between research, platform, mobile, backend, design, and QA work.

Use **22–28 weeks** as a risk-adjusted envelope when any of these apply:

- Native scanner, OCR, incoming-share, or SQLCipher fallbacks are required
- The team is smaller than the baseline
- Legal/privacy decisions are not available during foundation work
- Store enrollment or pilot-distribution requirements delay release
- Security or recovery testing finds material remediation

Phase durations are ranges, not promises. A phase exits on evidence, not elapsed
time. Calendar dates should be assigned only after owners and capacity are known.

### 5.3 Environment assumption

- Local development uses synthetic data only.
- Staging uses synthetic data and dedicated test accounts only.
- Production is the only environment permitted to contain real household data.
- Staging and production use isolated Railway projects, databases, buckets,
  secrets, credentials, analytics projects, and notification configuration.
- The initial pilot uses native binaries distributed through TestFlight and the
  applicable Google Play test track; it does not use EAS services or OTA.

## 6. Workstreams

| Workstream | Responsibility | Primary outputs |
| --- | --- | --- |
| Product discovery | Problem, usability, activation, pricing, and pilot evidence | Interview synthesis, prototype results, decision gates |
| Product design | Journeys, interaction states, copy, accessibility, design system | Approved flows, tokens, components, reference screens |
| Repository and developer experience | Monorepo, toolchain, CI, code generation, local setup | Reproducible workspace and quality commands |
| Mobile platform | Expo app, routing, native modules, local data, app lifecycle | Installable iOS/Android development clients |
| Identity and authorization | Better Auth, household roles, sessions, RLS, audit | Tenant-safe authentication and access control |
| Domain and contracts | Domain rules, Zod/OpenAPI, errors, client generation | Versioned API contract and framework-free rules |
| Data and synchronization | PostgreSQL, SQLCipher, outbox, change feed, conflicts | Offline-capable server-authoritative data path |
| Capture and records | Scanner/import, encryption, upload, record models, OCR | Reliable Vault and Smart Capture workflow |
| Utility loops | Today, reminders, tasks, Timeline, family, memories | Recurring household value loops |
| Trust and lifecycle | Consent, export, deletion, retention, keys, backups | Verifiable privacy and recoverability operations |
| Operations and support | Worker, staff console, runbooks, support workflows | Auditable operating surface and response procedures |
| Quality and release | Automated tests, performance, security, stores, pilot | Reproducible, monitored beta releases |

Every milestone has one accountable delivery owner even when several
workstreams contribute.

## 7. Dependency and Critical-Path Model

### 7.1 Critical path

The shortest safe path to a private beta is:

1. Resolve implementation-blocking open decisions.
2. Revalidate the dependency snapshot and pass native compatibility spikes.
3. Scaffold the monorepo, CI, Expo app, API, worker, and shared contracts.
4. Establish authentication, household authorization, RLS, audit, and secrets.
5. Establish encrypted local storage, sync, idempotency, and conflicts.
6. Ship the offline emergency-card walking skeleton.
7. Ship capture, encrypted upload, core records, provenance, and local search.
8. Ship OCR review, vaccinations, visits, prescriptions, and reminder dates.
9. Ship Today, notifications, tasks, Timeline, caregiver access, and memories.
10. Ship export, deletion, staff operations, observability, recovery, and pilot
    release controls.
11. Complete accessibility, performance, security, legal/privacy, and store
    gates.
12. Run the invited pilot and make the post-pilot update-strategy decision.

### 7.2 Work that may proceed in parallel

| Parallel track A | Parallel track B | Coordination point |
| --- | --- | --- |
| Parent and clinic research | Native compatibility spikes | Record categories and capture feasibility review |
| Monorepo/tooling | Privacy data map and threat model | Package boundaries and logging policy |
| Mobile shell | API/worker skeleton | Generated contract integration |
| Design-system primitives | Auth and household backend | Onboarding and error-state integration |
| Local repositories | Change-feed API | First end-to-end synchronization |
| Capture UI | Upload/validation pipeline | Encrypted document round trip |
| Today/Timeline designs | Reminder/task domain | Integrated utility-loop review |
| Staff-console shell | Export/deletion workers | Masked status and audited action review |
| Test automation | Feature implementation | Milestone gate execution |

### 7.3 Dependencies that must not be inverted

- Do not build broad feature screens before the app shell, theme, navigation,
  and representative accessibility behavior are verified on devices.
- Do not store domain records in TanStack Query, Zustand, or AsyncStorage.
- Do not implement cloud AI before manual review and on-device OCR work.
- Do not create reminders from unconfirmed extracted values.
- Do not expose staff actions before staff passkeys, purpose codes, masking, and
  audit exist.
- Do not start billing before the retention decision gate.
- Do not start partner-specific customization before direct-family activation
  and partner data-boundary acceptance are demonstrated.
- Do not accept real pilot data before production privacy, backup, deletion,
  support, and incident minimums pass.

## 8. Milestone Roadmap

| Milestone | Indicative window | Product outcome | Exit gate |
| --- | ---: | --- | --- |
| M0. Readiness and evidence | Weeks 1–4 | Technical baseline, decisions, and later-gate obligations recorded | Gate 0A closes M0; pre-pilot work continues in parallel |
| M1. Engineering foundation | Weeks 2–6 | Reproducible, deployable system skeleton | Gate 1 |
| M2. Offline trust slice | Weeks 5–9 | Secure enrollment and offline emergency card | Gate 2 |
| M3. Vault wedge | Weeks 8–13 | Capture, store, find, and confirm core records | Gate 3 |
| M4. Household utility loops | Weeks 12–17 | Today, reminders, tasks, Timeline, family, memory | Gate 4 |
| M5. Trust operations and beta hardening | Weeks 16–21 | Lifecycle operations and production-ready pilot build | Gate 5 |
| M6. Invited pilot and public-beta decision | Weeks 20–23+ | Evidence from 10–20 real participants | Gate 6 |
| M7. Retention-gated monetization and partners | After retention signal | Paid/sponsored entitlements without ownership compromise | Gate 7 |

The overlaps are intentional. A milestone may begin preparatory work before the
previous gate, but it may not depend on an unverified assumption from that gate.
Live progress, blockers, deferred obligations, retained artifacts, and completion
evidence are maintained outside this roadmap in the implementation status
tracker.

## 9. M0 — Readiness and Evidence

**Indicative duration:** 3–4 weeks
**Goal:** Make the project safe to scaffold and ensure the first implementation
targets evidence-backed product behavior.

M0 decisions, status, evidence, and blockers are maintained in the
[M0 Readiness and Evidence Dossier](../core/m0-readiness-and-evidence.md). M0 uses two
gates so technical preparation cannot be mistaken for complete product
validation:

The 18 July 2026 close-out decision is **PROCEED — M0 CLOSED**. The clean
dependency/native baseline and key iOS simulator probes pass. The founder moved
research, five-flow testing, physical-device acceptance, specialist approvals,
and organization-owned provider setup into parallel pre-pilot work. The dossier
is authoritative if this summary becomes stale.

- **Gate 0A** has passed and closes M0 for engineering-foundation work.
- **Pre-pilot readiness** retains every former Gate 0B obligation and blocks
  real child data, pilot distribution, and unsupported public claims—not
  synthetic-data implementation.

### 9.1 Product and design work packages

#### `RDY-01` Research operations and evidence repository

- Assign research owners and participant-recruitment sources.
- Schedule at least 20 parent, 10 co-parent, 5 caregiver, and 5 clinic sessions,
  with the remaining clinic target continuing as needed.
- Define consent, note-taking, anonymization, and synthesis practices.
- Separate founder-network and outside-network evidence.
- Create a decision log connecting findings to product changes.

#### `RDY-02` Critical-flow prototype validation

Test these five flows with representative parents:

1. Create an emergency card.
2. Scan and review a prescription.
3. Confirm a vaccination reminder.
4. Find a record through Timeline or search.
5. Invite a caregiver and assign a handover.

Record task success, time, intervention, comprehension, trust questions, and
accessibility observations. Resolve misleading medical or privacy language
before implementation.

#### `RDY-03` Record taxonomy and data map

- Define launch record categories and required/optional fields.
- Distinguish queryable metadata, encrypted payloads, original files,
  suggestions, confirmed values, provenance, audit, and analytics.
- Define vaccination, doctor visit, prescription, document, emergency, task,
  timeline, and memory schemas at a product level.
- Mark every field with purpose, sensitivity, retention, offline need, search
  need, export behavior, and deletion behavior.
- Use a pediatric advisor for clinical terminology and safety boundaries.

#### `RDY-04` Open product decisions

The implementation defaults are accepted as decisions `M0-D01` through
`M0-D10` in the M0 dossier. Parent-verification provider selection and legal
entity/store enrollment remain external pre-real-data/pre-pilot dependencies;
engineering must not bypass them with weaker temporary behavior.

#### `RDY-05` Design-system foundation specification

- Convert the design-system plan into a component inventory and state matrix.
- Define semantic token names without coupling them to the current prototype
  file shape.
- Include light, dark, high-contrast, reduced-motion, dynamic-type, offline,
  loading, empty, error, suggested, confirmed, verified, and destructive states.
- Define interaction and content requirements for emergency information,
  provenance, OCR review, reminders, and privacy notices.
- Select the first reference flows: onboarding/emergency, capture/review, Today,
  Vault, and Timeline.

### 9.2 Architecture and platform work packages

#### `RDY-06` Dependency and toolchain revalidation

- Revalidate Node, pnpm, Turborepo, TypeScript, Biome, Expo, React Native,
  Unistyles, Nitro, native modules, Fastify, Better Auth, Drizzle, PostgreSQL,
  Next.js, and test-tool compatibility as one snapshot.
- Validate Node 24.18.0 LTS and pnpm 11.14.0 as the accepted targets. The only
  pre-approved pnpm fallback is 11.13.1 with a recorded compatibility reason.
- Exact-pin the accepted versions during M1.
- Record upgrade exceptions in an ADR or dependency decision note.

#### `RDY-07` Native compatibility spike harness

Create the smallest disposable Expo development-client harness needed to test:

- Expo + React Native New Architecture + Unistyles
- React Compiler compatibility, with disablement as the accepted fallback
- SQLCipher creation, migration, lock/reopen, and biometric invalidation
- Better Auth email OTP, Apple, Google, refresh, logout, and revocation
- Multi-page scanner on physical iOS and Android devices
- Offline OCR on representative Indian medical documents
- Incoming image and PDF sharing from supported sources
- AES-GCM encrypt/upload/validate/download/decrypt behavior
- Notification token rotation and authenticated deep links
- Clean signed Android AAB and iOS archive creation
- TestFlight and applicable Google Play track install/upgrade

Each spike must end in one of three states: accepted package, local Expo-module
fallback, or explicit blocker with owner and resolution date.

#### `RDY-08` Threat model and privacy review kickoff

- Map actors, trust boundaries, abuse cases, and privileged operations.
- Cover household isolation, stolen devices, session theft, staff abuse, upload
  attacks, AI consent, notification disclosure, export, deletion, key loss, and
  provider compromise.
- Convert mitigations into testable controls owned by later work packages.
- Confirm which legal/privacy decisions must block real-data pilot use.

#### `RDY-09` Railway and store capability verification

- Confirm Railway Singapore plans, PostgreSQL 18/PITR behavior, bucket limits,
  recovery mechanics, environment isolation, and expected costs.
- Confirm Apple and Google developer accounts, entity details, tester rules,
  external-review lead times, and credential ownership.
- Select the credential vault and recovery custodians.

### 9.3 Gate 0A — Technical Readiness

Tooling-only M1 work is authorized when:

- Decisions `M0-D01` through `M0-D10` are recorded and source documents agree.
- Record taxonomy/data-map version 1 and the initial threat-control backlog exist.
- The dependency snapshot passes clean install, peer, Expo, type, and native
  project checks and is approved for exact pinning.
- Core native spikes pass on physical iOS and Android or have accepted local
  Expo-module fallbacks.
- Local Android and iOS build evidence is reproducible on the designated Mac.
- Railway capabilities and recovery limitations are documented.
- Entity, store, social-auth, signing, and provider dependencies have named
  owners and later-gate classification.
- The founder records an explicit proceed or hold decision.

Gate 0A authorizes M1 and later implementation against synthetic fixtures.
Real-data handling, pilot distribution, and production claims remain subject to
their named privacy, safety, security, provider, store, and physical-device
acceptance gates.

### 9.4 Parallel Pre-Pilot Readiness (Former Gate 0B)

The invited pilot and any real-child-data use are authorized only when:

- The five critical flows have a tested and approved interaction direction.
- Problem and capture-usability evidence meets the product-plan thresholds.
- Record taxonomy and terminology receive pediatric review.
- Privacy/legal review approves parent verification, consent, processors,
  retention, deletion, breach workflow, and real-data pilot conditions.
- TestFlight and Google Play organization-track install/upgrade tests pass.
- Apple, Google, and email authentication lifecycles pass with
  organization-owned credentials.
- No fatal problem, usability, accessibility, privacy, medical-safety, or native
  issue remains unresolved.
- The founder records an explicit proceed or hold decision.

These obligations continue in parallel after M0 closure. Do not represent a
deferred check as passed; attach its evidence at the owning pre-pilot gate.

## 10. M1 — Engineering Foundation

**Indicative duration:** 3–4 weeks, overlapping late M0
**Goal:** Establish a reproducible system skeleton whose boundaries match the
accepted architecture.

### 10.1 Ordered work packages

#### `FND-01` Monorepo and toolchain

- Create the pnpm workspace and Turborepo task graph.
- Establish `apps/mobile`, `apps/api`, `apps/worker`, and `apps/ops-web`.
- Establish `packages/contracts`, `domain`, `database`, `crypto`, `auth`,
  `observability`, `config`, `test-kit`, and `design-tokens`.
- Add exact versions, committed lockfile, root TypeScript configuration, root
  Biome configuration, supported Markdown tooling, and dependency boundaries.
- Add environment templates containing names and descriptions, never secrets.
- Document local prerequisites and one-command validation.

#### `FND-02` Continuous integration and supply-chain baseline

- Add deterministic install, format/lint, typecheck, unit, contract, and build
  tasks.
- Add secret scanning, dependency review, lockfile checks, and generated-client
  drift checks.
- Cache only safe build material.
- Prevent production deploys from unreviewed branches.
- Establish artifact and source-commit traceability.

#### `FND-03` Application skeletons

- Mobile: development client, Expo Router groups, safe areas, error boundary,
  deep-link skeleton, environment selection, and synthetic landing flow.
- API: Fastify boot, security headers, CORS, request IDs, Problem Details,
  liveness, readiness, and validated configuration.
- Worker: `pg-boss` boot, heartbeat, retry/dead-letter policy, and safe job logs.
- Staff web: Next.js shell, isolated staff auth placeholder, and no direct
  database dependency.

#### `FND-04` Contracts and domain kernel

- Establish Zod-to-OpenAPI generation and `/v1` conventions.
- Generate and compile mobile and staff clients.
- Add UUIDv7, timestamp, revision, cursor, idempotency, and Problem Details
  primitives.
- Define framework-independent household, child, consent, audit, and record
  identifiers and policies.
- Add breaking-contract detection in CI.

#### `FND-05` Database and migration foundation

- Create PostgreSQL roles for application, migration, worker, and read-only
  operational use.
- Establish Drizzle schema/migration conventions and explicit release migration.
- Add tenant context and RLS test harness.
- Add audit, idempotency, outbox, and change-event primitives.
- Use PostgreSQL integration tests, not in-memory substitutes, for RLS and
  transaction behavior.

#### `FND-06` Railway environment skeleton

- Provision isolated staging and production projects without production user
  traffic.
- Add API, worker, staff, PostgreSQL, private document bucket, PITR/recovery
  bucket placeholders, domains, readiness checks, and least-privilege access.
- Define secret ownership and rotation metadata.
- Deploy the empty system to staging through a documented release path.

#### `FND-07` Observability and privacy guards

- Define stable log codes and safe structured logging.
- Implement analytics and feature-flag wrappers with compile-time allowlists.
- Implement Sentry client/server scrubbing before enabling event delivery.
- Seed sensitive canary values into tests and fail on leakage.
- Add kill-switch defaults for uploads, AI, sharing, and notifications.

#### `FND-08` Design-system prototype reconciliation

This is the first package allowed to change the loose design-system artifacts.

- Inventory each existing token, theme, component, and screen file.
- Classify each as adopt, adapt, reference-only, or discard.
- Move adopted token intent into the real `design-tokens` package.
- Implement the real Unistyles 3 theme registration in the scaffolded mobile
  app using supported APIs verified by `RDY-07`.
- Add a development-only component gallery or reference route.
- Verify semantic-token enforcement, light/dark/high-contrast behavior, dynamic
  type, reduced motion, contrast, and touch targets.
- Do not preserve prototype APIs merely to avoid deliberate migration work.

#### `FND-09` ADR and engineering documentation baseline

- Create the initial ADR index and write the decisions needed by implemented
  foundation work.
- Add repository-boundary, data-classification, environment, migration,
  testing, and release-development notes.
- Record alternatives and review dates, not only final choices.

### 10.2 Gate 1 — Foundation Is Reproducible

M2 begins when:

- A clean checkout installs and passes the root validation command.
- Development clients build on physical iOS and Android devices.
- API, worker, and staff shells deploy to staging with correct readiness.
- OpenAPI generation and both clients compile without manual edits.
- A test migration runs forward against a fresh PostgreSQL instance.
- RLS test harness proves a seeded cross-household query is blocked.
- Logging, analytics, and error-reporting canaries show no sensitive leakage.
- Theme and core primitive reference states render accessibly on both platforms.
- Repository boundaries and implemented architecture choices have ADR coverage.

## 11. M2 — Offline Trust Slice

**Indicative duration:** 3–4 weeks
**Goal:** Deliver secure enrollment and an offline emergency-card vertical slice
through the production-shaped architecture.

### 11.1 Ordered work packages

#### `OFF-01` Consumer authentication and session lifecycle

- Implement email OTP first for deterministic development and test coverage.
- Add Apple and Google through the verified Better Auth integration.
- Implement non-enumerating responses, attempt/rate limits, explicit origins,
  minimal scopes, account-linking policy, session listing, and revocation.
- Store the mobile session only through SecureStore.
- Add reauthentication primitives for future export, deletion, and sensitive
  settings.

#### `OFF-02` Household, parent, child, consent, and audit

- Implement the first household owner, parent profile, and one child.
- Record versioned notice and consent acceptance before child creation.
- Add household membership and capability policies without exposing future
  complexity in the interface.
- Add append-only audit events for profile and access changes.
- Encrypt child and parent payload fields as defined by the data map.

#### `OFF-03` Local security and enrollment

- Generate and store a random SQLCipher key in SecureStore.
- Create the encrypted local schema and forward migrations.
- Add app lock, biometric policy, sign-out wipe behavior, and device enrollment.
- Handle biometric-enrollment invalidation through reauthentication and safe
  resynchronization.
- Add independently encrypted local-file primitives even if the first slice
  uses only an optional emergency photo.

#### `OFF-04` Repository and synchronization engine

- Implement repository reads from SQLCipher and background network refresh.
- Implement local mutation IDs, dependency ordering, retry/backoff, and status.
- Implement server change sequence, opaque cursor pull, mutation push,
  idempotency, tombstones, reset/full reconciliation, and audit.
- Make critical-field conflicts explicit and reviewable.
- Ensure TanStack Query coordinates lifecycle but never owns persisted domain
  truth.

#### `OFF-05` Emergency-card vertical slice

- Implement profile fields with "not provided" versus "none confirmed" states.
- Make the card reachable in no more than two deliberate post-unlock actions.
- Render from SQLCipher with no network.
- Support the approved biometric reauthentication/quick-access policy.
- Add contact actions, large-text behavior, selection where important, and
  privacy-safe empty/error states.
- Synchronize changes and preserve audit/version history.
- Defer shareable image/PDF unless explicitly promoted into committed MVP scope.

#### `OFF-06` Onboarding activation shell

- Implement value/privacy promise, account, consent, child basics, and emergency
  card setup.
- Continue into a synthetic or feature-flagged first-record step until M3.
- Instrument allowed funnel milestones without user or child identifiers.
- Keep optional profile questions progressive.

### 11.2 Gate 2 — Offline Trust Is Proven

M3 feature breadth is authorized when:

- A new parent can enroll, consent, create a child, and complete the emergency
  card on both platforms.
- The emergency card opens with airplane mode enabled after process restart.
- Sign-out makes sensitive local data inaccessible.
- Biometric invalidation recovers through reauthentication/resync.
- Two devices synchronize edits and display a stale critical-field conflict.
- Duplicate mutation retries do not create duplicate records or audit events.
- Cursor expiry rebuilds the local read model safely.
- Household RLS, BOLA, session revocation, and analytics-canary tests pass.
- Dynamic type up to 200%, screen readers, high contrast, and target low-end
  Android behavior pass for the emergency flow.

## 12. M3 — Vault Wedge

**Indicative duration:** 4–5 weeks
**Goal:** Let a parent reliably capture, store, confirm, search, retrieve, and
correct the MVP's core child records.

### 12.1 Ordered work packages

#### `VLT-01` Record model, versions, provenance, and timeline projection

- Implement common record metadata and encrypted versioned payloads.
- Keep suggestions separate from confirmed values.
- Add manual, imported, OCR-assisted, AI-assisted, provider-issued, and
  government-imported provenance states.
- Add corrections as new versions and deletes as immediate tombstones plus
  queued purge.
- Create a minimal linked timeline projection for all confirmed records.

#### `VLT-02` Manual record creation

- Start with document, vaccination, doctor visit, and prescription forms.
- Provide manual completion for every field that later extraction may suggest.
- Enforce parent-friendly validation and medical-safety copy.
- Save local drafts offline and synchronize confirmed records.
- Add create, edit/correct, view, and delete tests before scanner integration.

#### `VLT-03` Capture and import adapters

- Add camera, scanner, gallery, file/PDF picker, and incoming share paths in the
  order validated by M0 spikes.
- Copy sources into app-private temporary storage.
- Validate type, size, pages, and permissions.
- Normalize orientation and create bounded thumbnails off the JS thread.
- Preserve an opaque, resumable draft when capture or import is interrupted.

#### `VLT-04` File encryption and resumable upload

- Generate per-file data-encryption keys on device.
- Encrypt with AES-256-GCM and bind AAD to household/object context.
- Implement authorized upload sessions, ciphertext hash checks, multipart or
  resumable state, completion, retry, and cancellation.
- Wrap file keys through the provider-neutral key interface.
- Download ciphertext and decrypt only on an authorized enrolled device.
- Ensure object keys and temporary filenames contain no sensitive values.

#### `VLT-05` Worker-side file validation

- Recheck magic-byte MIME and file structure.
- Bound PDF parsing and reject active/executable content.
- Add malware scanning and safe preview derivation when authorized.
- Guarantee plaintext cleanup through terminal and failure paths.
- Record operational state without filenames or document content.

#### `VLT-06` On-device OCR and review

- Run OCR offline on supported images/documents.
- Apply deterministic candidate parsing for dates and known fields.
- Present source snippets, uncertainty, and "could not determine" states.
- Require an explicit accept/correct/reject action before confirmation.
- Prevent unconfirmed suggestions from search, reminders, emergency data, and
  authoritative timeline content.
- Measure correction buckets without transmitting extracted content.

#### `VLT-07` Vaccination, visit, and prescription behavior

- Implement vaccination due/scheduled/given/skipped/not-applicable states.
- Keep schedule suggestions, parent-confirmed dates, and provider/government
  records visually and structurally distinct.
- Implement doctor visit and prescription source links and corrections.
- Never calculate dosage, infer diagnosis, or silently modify instructions.
- Add reminder-driving dates only after explicit confirmation.

#### `VLT-08` Vault, local search, and retrieval

- Implement Vault hierarchy and recent records.
- Use FlashList for production collections.
- Add SQLite FTS over confirmed local data and household-scoped bounded server
  search.
- Support title, category, provider, date, tag, and confirmed vaccine/medicine
  fields according to policy.
- Keep selected/recent records available offline and apply cache quotas without
  evicting pinned emergency content.

#### `VLT-09` Duplicate and failure handling

- Define duplicate-warning heuristics without automatic destructive merging.
- Add upload resume, retry, terminal error, and local-source preservation.
- Handle permission revocation, disk pressure, corrupt files, unsupported PDFs,
  session expiry, and household access loss.
- Add user-visible recovery actions and stable diagnostic codes.

### 12.2 Gate 3 — The Vault Wedge Works

M4 begins when:

- A parent can manually create every launch record type.
- Supported images and PDFs can complete an encrypted round trip under network
  interruption.
- The original remains available until explicit deletion.
- OCR remains on device by default and all suggestions require review.
- Search returns only authorized, confirmed content and meets the one-second
  typical-household target locally.
- Timeline projections link back to the active source record version.
- Cross-household file, upload-session, search, and record attacks are blocked.
- Maximum PDF, concurrent upload, process termination, disk pressure, and
  low-memory device tests have documented results.
- Seeded sensitive values are absent from logs, analytics, Sentry, object keys,
  job payloads, and filenames.

## 13. M4 — Household Utility Loops

**Indicative duration:** 3–4 weeks
**Goal:** Turn safe storage into recurring value through Today, reminders,
Timeline, one-caregiver coordination, and a lightweight monthly memory.

### 13.1 Ordered work packages

#### `UTL-01` Reminder domain and scheduler

- Implement confirmed reminder definitions, UTC fire time, local timezone,
  category controls, completion, cancellation, and source-record linkage.
- Use deterministic job keys and idempotent scheduling/delivery.
- Recalculate future schedules on timezone changes without rewriting history.
- Require user confirmation for every extraction-derived date or meaning.

#### `UTL-02` Push and optional email delivery

- Explain notification value before requesting platform permission.
- Implement token registration, rotation, invalidation, safe retries, and
  environment isolation.
- Use generic lock-screen copy with authenticated deep links.
- Add email backup only if the M0 product decision promotes it into this phase.
- Verify provider webhooks, suppressions, and rate limits where email is used.

#### `UTL-03` Today dashboard

- Order urgent/overdue, due today, upcoming, handover, pending review, quick
  capture, and monthly memory according to the product hierarchy.
- Keep Today useful when no items are due.
- Present one obvious useful action rather than a content feed.
- Add offline, stale, partial-sync, permission-denied, empty, error, and loading
  states.

#### `UTL-04` Tasks and handover

- Add task creation, owner/caregiver assignment, due time, notes, source-record
  links, complete, and reopen.
- Support offline drafts/mutations and auditable corrections.
- Use cautious product language for medication-related tasks and always link to
  the confirmed source prescription.

#### `UTL-05` Timeline experience

- Group events by child age/month and support required filters.
- Link every generated event to its source record.
- Add manual notes and milestone entries.
- Use FlashList and validate smooth interaction with 2,000 mixed entries.
- Avoid complex reorder and editing behavior in MVP.

#### `UTL-06` Caregiver invitation and access

- Implement one invited member and the approved launch role mapping.
- Support invitation acceptance, selected capabilities, session/device state,
  revocation, and audit.
- Explain that revocation cannot erase copies already exported.
- Validate offline authorization changes and removal of revoked local data.

#### `UTL-07` Monthly memory capsule

- Support up to five photos, short prompts, one milestone, optional caregiver
  note, and future-unlock metadata.
- Keep completion under five minutes in usability testing.
- Apply the approved local-versus-cloud media policy.
- Save a linked Timeline entry and retain a manual text-only fallback.

#### `UTL-08` Optional consented cloud extraction

This package may start only after `VLT-06` is complete and product evidence says
cloud extraction improves the flow.

- Implement feature-specific consent and separate original-document consent.
- Send minimized OCR text by default.
- Enforce regional/provider policy through the extraction gateway.
- Validate structured output, store encrypted suggestions, capture model/prompt
  versions, and require review.
- Add feature kill switch, frozen evaluation fixtures, latency/cost ceilings,
  withdrawal behavior, and manual fallback.

### 13.2 Gate 4 — Recurring Utility Is Ready

M5 starts when:

- Today provides a useful next action in populated and empty states.
- Confirmed reminders fire once, use generic notifications, and deep-link safely.
- Timezone changes, retries, token rotation, and disabled permissions behave
  correctly.
- Tasks synchronize offline and respect caregiver capability boundaries.
- Timeline performs with the target dataset and links to source versions.
- A caregiver can be invited and revoked without unauthorized future access.
- A monthly capsule can be completed within the five-minute product target.
- Any enabled AI path has explicit consent, review, evaluation evidence, and a
  working manual fallback.

## 14. M5 — Trust Operations and Beta Hardening

**Indicative duration:** 3–4 weeks, overlapping late M4
**Goal:** Make the product operable, recoverable, supportable, and safe enough
for real invited participants.

### 14.1 Ordered work packages

#### `BTA-01` Export lifecycle

- Require recent owner reauthentication.
- Generate JSON/CSV structured data, organized original files, human-readable
  PDF summary, and Timeline export asynchronously.
- Preserve provenance and confirmed values.
- Encrypt temporary export artifacts, issue short-lived authenticated download,
  and verify expiry/purge.
- Test a realistic maximum household and interrupted generation.

#### `BTA-02` Record, child, and account deletion

- Implement individual record, child, household/account, and processor deletion
  workflows.
- Propagate tombstones to enrolled devices and local search/cache.
- Revoke sessions/tokens and purge source, derived, suggestion, and temporary
  material according to approved policy.
- Isolate minimized legal/security retention and communicate lifecycle clearly.
- Prove idempotency, restartability, and completion evidence.

#### `BTA-03` Backup, restore, and key operations

- Enable and monitor production PITR.
- Add encrypted logical backup and ciphertext-object recovery copy/inventory.
- Implement key versioning, rotation, bounded rewrap, rollback window, and audit.
- Run a sibling-database restore drill and document cutover/rollback.
- Run a missing-object and key-recovery exercise.
- Record the accepted Railway-only recovery limitations in the runbook.

#### `BTA-04` Staff identity and support console

- Require allowlisted staff identities and passkeys.
- Implement exact normalized-email lookup through a privileged endpoint.
- Show masked account, household, session/device, upload status,
  export/deletion status, entitlement, and audit information.
- Add session revocation, safe message resend, and audited entitlement override.
- Require purpose codes and recent reauthentication for privileged operations.
- Prohibit document/OCR/health browsing, direct SQL, impersonation, and key
  access in both interface and API policy.

#### `BTA-05` Analytics and experiment verification

- Implement the activation funnel and approved high-value events through the
  compile-time allowlist.
- Use an unjoined random installation identifier.
- Verify event semantics, deduplication, offline delivery, and environment
  separation.
- Disable autocapture, replay, heatmaps, screenshots, view hierarchies, and
  automatic properties.
- Run automated and manual canary inspection before every beta release.

#### `BTA-06` Reliability and performance hardening

- Test current/oldest-supported iPhone and current-midrange/lower-memory Android.
- Use 2,000 Timeline entries, 500 records, 1,000 search terms, 100 pending
  mutations, 20 pending uploads, and maximum PDF fixtures.
- Measure cold start, bundle/app size, memory, dropped frames, JS blocking,
  upload/sync latency, API latency, queue age, and database connections.
- Fix correctness and crash issues before micro-optimization.
- Meet at least 99.5% crash-free sessions during beta.

#### `BTA-07` Accessibility and content QA

- Verify screen readers, reading order, labels, focus, dynamic type to 200%,
  high contrast, color independence, reduced motion, selectable values, minimum
  touch targets, and keyboard behavior where relevant.
- Review medical, privacy, consent, notification, empty, destructive, and
  recovery copy.
- Test with representative users, not automated checks alone.

#### `BTA-08` Security assurance

- Complete RLS/BOLA, role, staff, session, OTP, upload, AI-consent, analytics,
  export, deletion, and secret-leak test suites.
- Review encryption formats, nonce handling, AAD, key lifecycle, temporary
  plaintext, and dependency/native supply chain.
- Conduct an independent penetration test before broad public launch and,
  ideally, before expanding the invited cohort.
- Resolve all critical/high findings or record an explicit launch blocker.

#### `BTA-09` Production and incident runbooks

Create, review, and exercise runbooks for:

- Deployment and migration
- Rollback and read-only mode
- Session and credential revocation
- Queue backlog and failed jobs
- Upload/storage incident
- Notification mistake
- Suspected privacy or security incident
- Key compromise and rewrap
- PITR and document restoration
- Export/deletion escalation
- Store-build regression and previous-commit rebuild
- Provider outage and feature kill switch

#### `BTA-10` Native pilot release readiness

- Rebuild Android and iOS artifacts from a clean checkout on the designated Mac.
- Verify identifiers and environment selection cannot be mixed.
- Record commit, lock hash, app/build version, tool versions, and migration range.
- Test credential recovery from the approved vault.
- Install and upgrade through TestFlight and the applicable Google Play track.
- Prepare review notes, demo instructions, privacy/data-safety declarations,
  support contacts, and release/rollback checklist.

#### `BTA-11` Support and pilot operations

- Define support categories, response targets, escalation owners, and masking.
- Recruit 10–20 named participants with device coverage and at least half
  outside the founder network when practical.
- Define consent/feedback process, release cadence, stop criteria, success
  metrics, and data-handling expectations.
- Prepare a known-issues list and participant communication templates.

### 14.2 Gate 5 — Real-Data Pilot Ready

The invited pilot may accept real household data only when:

- Product, trust/security, and app-store readiness checklists pass.
- Export and deletion complete end to end in staging.
- PITR is enabled and a restore drill has succeeded.
- Signing recovery and previous-known-good rebuild have succeeded.
- Production/staging separation and secret access have been reviewed.
- Staff passkeys, masking, purpose codes, and audit are enforced.
- Legal/privacy review approves consent, retention, processors, disclosures,
  support, and incident handling.
- No unresolved critical/high security finding remains.
- Emergency offline, two-device conflict, interrupted upload, notification
  privacy, and revoked-caregiver scenarios pass on physical devices.
- Pilot participants, support owners, release cadence, metrics, and stop criteria
  are documented.

## 15. M6 — Invited Pilot and Public-Beta Decision

**Indicative duration:** At least two native release cycles
**Goal:** Validate usability, activation, trust, reliability, and recurring value
before scaling scope, distribution, or monetization.

### 15.1 Pilot execution

#### `PLT-01` Cohort onboarding

- Release through external TestFlight and the applicable Play test track.
- Observe onboarding only with explicit participant agreement.
- Track permitted funnel events and support issues.
- Separate product failure from build/install/store-access failure.

#### `PLT-02` Weekly evidence review

Review:

- Emergency-card completion
- Time to first and third record
- Confirmed reminder creation
- Seven-day activation
- Retrieval/search success
- OCR completion and correction buckets
- Caregiver invitation anxiety/value
- Crash-free sessions and critical errors
- Upload/sync conflicts and resets
- Support requests, privacy questions, and incorrect-reminder reports

Do not change core event definitions mid-cohort without versioning the analysis.

#### `PLT-03` Controlled release cycles

- Ship fixes as complete native binaries.
- Run release gates on every build.
- Preserve the embedded bundle and offline emergency behavior.
- Use feature flags only through safe defaults and kill switches.
- Record review delay, release frequency, rollback need, and operational effort.

#### `PLT-04` Post-pilot update strategy ADR

After at least two release cycles, compare:

1. Continued store-only native releases
2. EAS Update
3. Signed self-hosted Expo Updates

Evaluate cost, signing, rollback, runtime compatibility, store policy, emergency
startup, and operational burden. No OTA option becomes a production dependency
before this ADR is approved and tested.

#### `PLT-05` Public-beta go/no-go review

Compare actual evidence with the product validation gates:

- Problem: 60% of target interviews report a recent concrete failure.
- Usability: 80% complete first capture without moderator intervention.
- Activation: 40% of qualified households activate within seven days.
- Week-4 retention: 30% of activated households perform a core action.
- Crash-free: at least 99.5% during beta and trending toward 99.8%.
- Trust: no uncontained security/privacy incident or unsafe reminder pattern.

Classify the result as proceed, proceed with constraints, extend pilot, narrow,
or stop/pivot. Record the decision and evidence.

### 15.2 Gate 6 — Public Beta and Retention Learning

Public-beta expansion requires:

- Gate 5 remains green after pilot operation.
- The product reaches the agreed activation and usability minimums or has a
  specific evidence-backed remediation cohort.
- Week-4 retention is measurable; paid acquisition does not scale below 25%.
- Crash, sync, upload, notification, support, export, and deletion behavior are
  within approved thresholds.
- The release/update ADR is approved and its selected approach is implemented
  or store-only continuation is explicitly accepted.
- Penetration test, privacy disclosures, app-store metadata, support capacity,
  backup/recovery, and incident response are ready for the expanded cohort.

## 16. M7 — Retention-Gated Monetization and Partner Pilot

This milestone is outside the initial retention-validation release. It starts
only after the product decision gate authorizes it.

### 16.1 Entry conditions

- Activated-household Week-4 retention meets the internal threshold.
- Non-family payment evidence or credible sponsor demand exists.
- Support and storage unit economics are understood.
- The core product works without partner-specific dependencies.
- Candidate partners accept family ownership and aggregate-only reporting.

### 16.2 Ordered work packages

#### `MON-01` Packaging and entitlement rules

- Finalize Free, Plus, founding, sponsorship, grace, and lapse behavior.
- Keep data safe and retrievable when an entitlement lapses.
- Define storage/feature limits and precedence independently of store SDKs.

#### `MON-02` Store billing

- Add the selected billing adapter behind `EntitlementProvider`.
- Implement purchase, restore, receipt/webhook validation, reconciliation,
  grace, cancellation, and support states.
- Keep store/customer identifiers out of product analytics.
- Complete subscription disclosure and app-store review.

#### `MON-03` Sponsored entitlements and attribution

- Add sponsor codes, redemption, expiry, precedence, and partner attribution.
- Keep individual household content invisible to partners.
- Expose only approved aggregate metrics with minimum cohort/privacy rules.

#### `MON-04` Partner pilot operations

- Agree contract, parent disclosure, data boundary, support escalation, cohort,
  attribution, success metrics, and termination behavior before launch.
- Reject white-label or individual-record access requirements.
- Measure whether referred households activate at least 1.5 times direct
  cohorts before expanding integration.

### 16.3 Gate 7 — Monetization/Partner Expansion

Expand only when:

- Purchases, restore, webhook replay, reconciliation, grace, lapse, and support
  are reliable.
- Sponsored access does not change household ownership or privacy posture.
- Payment or sponsor economics are viable.
- Partner-referred activation meets the agreed threshold.
- Aggregate reports contain no sensitive content.
- Partner operational burden does not destabilize the consumer product.

## 17. Integrated Epic Backlog

The following epics map the product backlog to the implementation roadmap.

| Epic | Product scope | Primary milestone | Principal dependencies |
| --- | --- | --- | --- |
| E1. Readiness and evidence | Research, prototypes, taxonomy, decisions | M0 | None |
| E2. Platform foundation | Monorepo, CI, apps, environments, ADRs | M1 | M0 technical spikes |
| E3. Design system | Tokens, themes, primitives, domain components | M0–M5 | Scaffold, Unistyles spike |
| E4. Identity and household | Auth, consent, child, membership, sessions | M2 | Contracts, database, RLS |
| E5. Emergency and offline | App lock, SQLCipher, sync, emergency card | M2 | Identity, local security |
| E6. Vault and records | Manual records, versions, search, provenance | M3 | Offline core, contracts |
| E7. Capture and Smart Capture | Scanner, upload, OCR, review, optional AI | M3–M4 | Crypto, worker, records |
| E8. Vaccination and reminders | States, confirmed dates, scheduler, push | M3–M4 | Records, worker, consent |
| E9. Today | Priority cards and next useful action | M4 | Reminders, tasks, review queue |
| E10. Timeline | Age feed, source links, notes, filters | M3–M4 | Records, child age rules |
| E11. Family handover | Invite, capabilities, tasks, revocation | M4 | Household authorization, sync |
| E12. Memory capsule | Prompt, limited media, Timeline entry | M4 | Files, Timeline, caregiver |
| E13. Trust lifecycle | Export, deletion, retention, keys, recovery | M2–M5 | Every data-bearing module |
| E14. Operations | Staff console, support, runbooks, observability | M1–M5 | Staff auth, worker, audit |
| E15. Quality and release | E2E, performance, security, stores, pilot | M0–M6 | Continuous across all epics |
| E16. Monetization and partners | Billing, sponsorship, attribution | M7 | Retention gate, entitlements |

### 17.1 Design-system rollout within the epics

| Layer | First consumers | Required verification |
| --- | --- | --- |
| Semantic tokens | App shell and reference gallery | No literal UI colors, contrast matrix |
| Typography/layout | Onboarding and emergency card | 200% type, safe areas, tablet width |
| Inputs/buttons/feedback | Auth and child profile | Screen readers, focus, loading/errors |
| Record/provenance components | Manual records and OCR review | Non-color states, source clarity |
| Lists/search/cards | Vault and Timeline | Large datasets, reduced motion |
| Sheets/dialogs/destructive flows | Permissions, correction, deletion | Focus, confirmation, recovery copy |
| Domain compositions | Today, emergency, capture review | Physical-device usability tests |

The design system evolves with real product slices. Do not attempt to finish a
large abstract component library before its first consumers exist.

## 18. Work-Package Planning Template

Before implementing any package, create a short plan containing:

### 18.1 Problem and outcome

- User or operational problem
- Observable outcome
- Included and excluded behavior
- Relevant product acceptance criteria

### 18.2 Dependencies and decisions

- Required earlier work packages
- Affected ADRs and source-document sections
- Open decisions and named owners
- Provider/native compatibility assumptions

### 18.3 Data and trust review

- Data read, created, changed, exported, or deleted
- Plaintext versus encrypted fields
- Authorization and RLS capabilities
- Offline, sync, conflict, and tombstone behavior
- Consent, retention, audit, analytics, logging, and staff visibility
- Abuse cases and threat-model controls

### 18.4 Contract and failure design

- Domain commands, queries, events, and invariants
- API request, response, Problem Details, idempotency, and revision behavior
- Local schema and server migration
- Loading, empty, offline, stale, conflict, retry, permanent-failure, and
  permission-loss states
- Rollout flag, kill switch, rollback, and compatibility plan

### 18.5 User experience and accessibility

- Flow and content/copy approval
- Design-system components and any new token/component need
- Dynamic type, screen reader, contrast, reduced motion, touch targets, and
  device-size behavior
- Manual fallback for automated or provider-dependent behavior

### 18.6 Verification

- Unit, integration, contract, component, E2E, security, and performance tests
- Physical-device scenarios
- Synthetic fixtures, including sensitive canary values
- Observability and support diagnostics
- Acceptance owner and evidence location

### 18.7 Delivery slices

Prefer slices that are independently reviewable and leave the system valid:

1. Domain and contract
2. Persistence, authorization, and migration
3. Local repository/offline behavior
4. Basic accessible interface with manual happy path
5. Failure, conflict, recovery, and audit behavior
6. Automation/provider integration
7. Performance and release hardening

The exact order may vary, but no package is done with only a visual happy path.

## 19. Definitions of Ready and Done

### 19.1 Definition of Ready

A work package is ready when:

- Its user/operational outcome and exclusions are clear.
- Product acceptance criteria are linked or written.
- Dependencies and open decisions have owners.
- Data classification and authorization impact are understood.
- Required design/copy is approved enough for the next slice.
- Contract and migration approach are known.
- Failure, offline, accessibility, observability, and test expectations exist.
- No unresolved blocker from a prior milestone gate is being bypassed.

### 19.2 Definition of Done

A work package is done when:

- The end-to-end outcome works in the intended environment.
- Code respects repository and dependency boundaries.
- Relevant unit, integration, contract, component, and E2E tests pass.
- Authorization, RLS, privacy, audit, and sensitive-data canaries pass.
- Offline/conflict behavior is implemented where applicable.
- Loading, empty, error, retry, and recovery states are usable.
- Accessibility requirements pass automated and manual review.
- Observability is privacy-safe and sufficient for support.
- Migrations, rollout, rollback, and feature-flag behavior are documented.
- Architecture changes have ADRs.
- Documentation and generated clients are current.
- Acceptance evidence is recorded and the accountable owner signs off.

## 20. Quality Gate Matrix

| Gate | Required evidence | Blocks |
| --- | --- | --- |
| Contract | OpenAPI diff reviewed; generated clients compile | Integration/release |
| Database | Migration forward test; RLS integration tests | Staging deploy |
| Mobile | iOS/Android physical-device smoke | Package completion |
| Offline | Restart, airplane mode, retry, cursor reset, conflict | Milestone exit |
| Security | BOLA/RLS, session, upload, consent, leakage cases | Real data/public beta |
| Privacy | Data map, consent, retention, analytics allowlist | Feature enablement |
| Accessibility | Screen reader, 200% type, contrast, motion, target size | Milestone exit |
| Performance | Target-device and dataset measurements | Public beta |
| Recovery | PITR/object/key/runbook exercise | Real-data pilot |
| Release | Clean build, signing recovery, store install/upgrade | Pilot release |
| Product | Usability/activation/retention evidence | Scope expansion |

## 21. Test Portfolio by System Boundary

### 21.1 Domain and API

- Domain invariants, role capabilities, schedules, conflicts, and entitlements
- Problem Details shapes and stable error codes
- Authentication lifecycle and rate limits
- Household ID tampering and cross-tenant access
- Revision conflict and idempotent retry behavior
- Outbox atomicity and worker idempotency
- Cursor order, expiry, reset, and tombstone behavior

### 21.2 Mobile and offline

- Enrollment, app lock, sign-out, biometric invalidation
- Emergency access without network
- Draft survival after process termination
- Upload interruption and resume
- Two-device critical conflicts
- Access revocation while one device is offline
- Local-search deletion and cache eviction
- Deep links after authentication and from cold start

### 21.3 Files, OCR, and AI

- MIME spoofing, malformed/oversized PDFs, decompression/resource exhaustion
- Unique nonces, AAD mismatch, hash mismatch, wrong-household key use
- Plaintext temporary cleanup under exceptions and cancellation
- OCR manual fallback and unconfirmed-value isolation
- AI missing/withdrawn/wrong-feature consent
- Schema-invalid, ambiguous, low-confidence, and provider-failure outputs
- Frozen extraction evaluation on representative de-identified fixtures

### 21.4 Operations and lifecycle

- Staff masking, purpose codes, recent reauthentication, and audit
- Export authorization, content, expiry, and purge
- Deletion restartability, processor calls, and backup lifecycle
- PITR and document recovery
- Notification privacy and duplicate prevention
- Sensitive-canary scans across analytics, logs, errors, jobs, and storage keys

## 22. Metrics and Delivery Health

### 22.1 Product metrics

Use the product plan's definitions for activation, MAOH, funnel, retention,
quality, and payment. Implementation must not weaken or silently redefine them.

### 22.2 Engineering delivery metrics

Track trends, not individual performance:

- Lead time from ready package to accepted outcome
- Change failure and rollback rate
- Escaped defects by severity and boundary
- Flaky-test rate and gate duration
- Crash-free sessions
- API latency/error class and queue age
- Sync conflict/reset rate
- Upload completion/retry/failure rate
- Accessibility defects found after package completion
- Security/privacy findings and remediation age
- Restore-drill and release-rebuild success

### 22.3 Milestone review questions

At every gate ask:

1. What user or operational behavior is now proven?
2. Which assumption remains unproven?
3. What sensitive data or privilege was added?
4. Can the system recover from partial failure?
5. Can support diagnose it without seeing child content?
6. What was learned that should change scope or sequence?
7. Is the next milestone still the highest-value risk to retire?

## 23. Operating Cadence

| Cadence | Review |
| --- | --- |
| Daily during implementation | Delivery blockers, production-shaped risks, security incidents |
| Weekly | User research, milestone evidence, product metrics, quality trends |
| Fortnightly during beta | Native release train and regression gate |
| Monthly | Privacy/security, dependency updates, recovery readiness |
| Monthly after partner work starts | Partner pipeline and data-boundary review |
| Quarterly | Product-scope reset, architecture triggers, provider/cost review |

Recommended working sessions:

- Milestone kickoff: outcome, gate, owners, dependencies, capacity
- Work-package kickoff: Section 18 plan and delivery slices
- Design/contract review: before high-cost implementation
- Threat/data review: before new sensitive fields or privileged actions
- Gate review: evidence and explicit proceed/hold decision
- Retrospective: update the roadmap rather than accumulating invisible process

## 24. Risk Register and Contingencies

| Risk | Early signal | Contingency |
| --- | --- | --- |
| Native module incompatibility | Spike fails on one platform | Build local Expo module; extend M0/M1 |
| Product breadth expands | Work enters without gate linkage | Apply scope precedence; move to later milestone |
| Design prototypes become accidental architecture | Imports depend on loose paths/APIs | Quarantine until `FND-08`; adopt file by file |
| Offline sync complexity grows | Feature-specific sync code appears | Centralize repository/outbox patterns before M3 |
| Authorization drift | Route-specific role checks diverge | Capability policy + RLS + shared adversarial tests |
| OCR slows capture | High correction/abandonment | Default to manual flow; narrow extraction categories |
| Reminder safety issue | Incorrect or unconfirmed date drives alert | Disable category; require confirmation; audit source |
| Sensitive telemetry leak | Canary or payload review fails | Disable provider at wrapper; block release |
| Railway recovery/custody rejected | Security/partner review objects | Trigger off-provider backup/KMS migration plan |
| Store/pilot delay | Account/tester/review constraint appears | Start verification in M0; keep tracks explicit |
| One-Mac build dependency fails | Recovery build cannot be reproduced | Restore toolchain/credentials; add second builder trigger |
| Low activation or retention | Pilot misses thresholds | Narrow workflow; do not add billing/acquisition spend |
| Partner pressure changes ownership | Requests for record access/white label | Reject partner per product gate |

## 25. First Planning Queue

The recommended M1 implementation sequence is:

1. `FND-01` — finalize the monorepo scaffold, exact pins, root
   commands, task graph, configuration boundaries, and clean-checkout workflow.
2. `FND-03` — create the four application skeletons and transfer the
   accepted Expo/native configuration into the real mobile application.
3. `FND-02` — establish deterministic CI and the supply-chain baseline around
   the root commands created by `FND-01`.
4. `FND-04` — establish contract generation and the initial domain kernel.
5. `FND-05` — establish PostgreSQL roles, migrations, tenant context, and RLS tests.
6. `FND-07` — add observability and privacy guardrails before feature data flows.
7. `FND-08` — reconcile the design-system prototypes after the scaffold exists.
8. `FND-09` — record the implemented foundation choices and spike retirement
   decision in ADRs.
9. `FND-06` — provision and validate the Railway environment skeleton when the
   required organization-owned access is available.
10. `OFF-01` + `OFF-02` — plan authentication, household, consent, and audit.
11. `OFF-03` + `OFF-04` — plan local security and synchronization.
12. `OFF-05` — plan the emergency-card walking skeleton and Gate 2 scenarios.

This section expresses dependency order, not current delivery state. Use the
[Implementation Status Tracker](../IMPLEMENTATION_STATUS.md) to select the next
`READY` item and to see completed, active, blocked, or deferred work.

The first implementation commit should not be a feature screen. It should follow
the accepted `FND-01` plan and create the reproducible repository foundation.

## 26. Decisions Deferred by This Roadmap

This roadmap intentionally does not decide:

- Provider selection for adult identity/age verification before privacy-counsel approval
- The legal organization structure, which requires qualified Indian legal/accounting advice
- Final versions beyond the Gate 0A dependency snapshot and its documented fallback
- Whether a failed native package should be patched or replaced before its spike
- The final UI/component API of the current prototype files
- The public-production OTA strategy before two pilot release cycles
- Billing provider activation before retention evidence
- Independent KMS or off-provider backup timing before a migration trigger
- Post-MVP multi-child, rich sharing, granular roles, large media, WhatsApp/SMS,
  government/provider integrations, or school/older-child features

Each deferred item has an evidence point. Deferral must not become an implicit
default implementation.

## 27. Final Delivery Position

LittleArc should be implemented as a sequence of secure, observable vertical
slices rather than as separate mobile, backend, or design-system projects. The
highest-risk architecture—native compatibility, household isolation, encrypted
offline data, synchronization, document handling, and recovery—must be proven
before feature breadth or real-data scale.

The operational definition of MVP is not merely that Today, Vault, and Timeline
screens exist. It is that a parent can safely enroll, store and retrieve real
records, use emergency information offline, confirm rather than inherit
automated suggestions, coordinate with one caregiver, recover from failures,
export or delete their data, and receive support without surrendering private
child content.

The roadmap therefore treats privacy, offline correctness, accessibility,
recovery, and release operations as product work on the critical path. Billing,
partner expansion, and broader family features begin only after the core product
demonstrates activation, retention, and trust.

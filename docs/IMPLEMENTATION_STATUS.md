# LittleArc Implementation Status

> **Status:** Active delivery dashboard
> **Version:** 1.0
> **Last updated:** 24 July 2026
> **Execution plan:** [Implementation Plan and Roadmap](./impl-plan/roadmap.md)
> **Core documents:** [Product plan](./core/littlearc-complete-product-plan.md),
> [architecture](./core/littlearc-architecture-and-tech-stack.md),
> [backend data model](./core/backend-data-model-and-database-schema.md),
> [design system](./core/design-system.md), and
> [M0 evidence](./core/m0-readiness-and-evidence.md)
> **Accountable owner:** Founder/product lead

---

## 1. Purpose

This file is the operational source of truth for LittleArc delivery status and
the first document that developers and AI agents should open. The
implementation roadmap defines scope, ordering, dependencies, and gates; this
tracker records what is complete, in progress, ready, blocked, deferred, or not
started.

Update this tracker whenever a work package changes state. Do not rewrite the
roadmap merely to report progress. Detailed decisions and test evidence remain
in their owning dossier, ADR, test report, or work-package brief and are linked
from here.

## 2. Documentation Map

| Area | Purpose | Location |
| --- | --- | --- |
| Context index | Repository knowledge catalogue and deterministic context map | [`docs/index.md`](./index.md), [`docs/context-map.yaml`](./context-map.yaml) |
| Core | Foundational product, architecture, data-model, design, and readiness decisions | [`docs/core/`](./core/) |
| Reference | Local setup, environment catalog, operations notes, troubleshooting, and migrations | [`docs/reference/`](./reference/) |
| Implementation plans | Roadmap, work-package plans, module status, and validation evidence | [`docs/impl-plan/`](./impl-plan/) |
| ADRs | Important architecture or process decisions that are difficult to reverse | [`docs/adr/`](./adr/) |
| Templates | Reusable document skeletons for future docs | [`docs/templates/`](./templates/) |

## 3. Status Tags

| Tag | Meaning |
| --- | --- |
| `COMPLETE` | Acceptance criteria passed and completion evidence is linked |
| `IN PROGRESS` | Work has started and has an owner and immediate next action |
| `READY` | Entry conditions are met and the item may be started |
| `BLOCKED` | Work cannot proceed until the stated condition changes |
| `DEFERRED` | Intentionally assigned to a later named gate or milestone |
| `NOT STARTED` | Planned but its entry conditions or sequence have not been reached |
| `RETAINED` | Completed supporting artifact intentionally kept until a retirement condition passes |

A milestone and one of its work packages can have different tags. For example,
M0 is `COMPLETE`, while a pre-pilot obligation first identified in M0 remains
`DEFERRED`. A deferred or blocked check must never be reported as passed.

## 4. Current Snapshot

| Scope | Tag | Owner | Next action or completion evidence |
| --- | --- | --- | --- |
| M0. Readiness and evidence | `COMPLETE` | Founder/product + engineering | Gate 0A closed on 18 July 2026; see the M0 dossier |
| M1. Engineering foundation | `COMPLETE` | Engineering | Gate 1 closed on 20 July 2026; all nine foundation packages plus device/accessibility and Aiven PostgreSQL RLS evidence accepted |
| `FND-01` Monorepo and toolchain | `COMPLETE` | Engineering | Root workspace, boundaries, exact pins, and clean-checkout proof accepted; see [evidence](./impl-plan/m1-foundation/fnd-01-implementation-evidence.md) |
| `FND-02` CI and supply-chain baseline | `COMPLETE` | Engineering | Local and hosted validation, required PR checks, source traceability, and repository controls accepted; see [evidence](./impl-plan/m1-foundation/fnd-02-implementation-evidence.md) |
| `FND-03` Application skeletons | `COMPLETE` | Engineering | Mobile, API, worker, and staff shells accepted; see [evidence](./impl-plan/m1-foundation/fnd-03-implementation-evidence.md) |
| `FND-04` Contracts and domain kernel | `COMPLETE` | Engineering | `/v1` metadata, OpenAPI generation, generated clients, domain primitives, and contract guards accepted; see [evidence](./impl-plan/m1-foundation/fnd-04-implementation-evidence.md) |
| `FND-05` Database and migration foundation | `COMPLETE` | Engineering | Drizzle schema, reviewed SQL migration, tenant context, RLS policy source, audit/idempotency/outbox/change primitives, metadata integration, and clean-checkout proof accepted; see [evidence](./impl-plan/m1-foundation/fnd-05-implementation-evidence.md) |
| `FND-06` Railway environment skeleton | `COMPLETE` | Engineering | Staging-only Railway descriptors, manifest, health checks, live Railway staging deploys, hosted migration evidence, and validation accepted; production setup deferred by founder direction; see [evidence](./impl-plan/m1-foundation/fnd-06-implementation-evidence.md) |
| `FND-07` Observability and privacy guards | `COMPLETE` | Engineering | Safe logger, allowlisted analytics/flags, Sentry scrubbing, kill switches, and leakage canaries accepted; see [evidence](./impl-plan/m1-foundation/fnd-07-implementation-evidence.md) |
| `FND-08` Design-system prototype reconciliation | `COMPLETE` | Engineering | Semantic tokens, three themes, accessible primitives, dev gallery, enforcement, exports, and clean-checkout proof accepted; see [evidence](./impl-plan/m1-foundation/fnd-08-implementation-evidence.md) |
| `FND-09` ADR and engineering documentation baseline | `COMPLETE` | Engineering | Eight foundation ADRs, six engineering notes, structural enforcement, context lookup, and clean-checkout proof accepted; see [evidence](./impl-plan/m1-foundation/fnd-09-implementation-evidence.md) |
| M2. Offline trust slice | `IN PROGRESS` | Engineering | `OFF-01` through `OFF-06` are complete; bounded physical-Android plus iOS-Simulator onboarding passed, while Gate 2 remains open for two-device conflict, full assistive-technology/low-end coverage, and its other named criteria |
| iOS Simulator cross-milestone parity validation | `COMPLETE` | Engineering | Every `RDY-01` through `RDY-09`, `FND-01` through `FND-09`, Gate 1, and `OFF-01` through `OFF-06` row has a current Simulator, owning automated, not-applicable, or deferred result; see [plan](./impl-plan/ios-simulator-parity-validation-plan.md) and [evidence](./impl-plan/ios-simulator-parity-validation-evidence.md) |
| `OFF-01` Consumer authentication and session lifecycle | `COMPLETE` | Engineering | Better Auth policy, reviewed schema/migration, API/SecureStore boundaries, 111-test root suite, Aiven PostgreSQL lifecycle, and bounded Pixel 8 SecureStore/deep-link evidence accepted; see [evidence](./impl-plan/m2-offline-trust/off-01-implementation-evidence.md) |
| `OFF-02` Household, parent, child, consent, and audit | `COMPLETE` | Engineering | Encryption, atomic onboarding, RLS, append-only evidence, 126 tests, Aiven PostgreSQL, builds, validation, clean-checkout, and bounded Pixel 8 UI/HTTP/database proof accepted; see [evidence](./impl-plan/m2-offline-trust/off-02-implementation-evidence.md) |
| `OFF-03` Local security and enrollment | `COMPLETE` | Engineering | Authority-neutral enrollment, device-bound key custody, SQLCipher and authenticated files, invalidation recovery, verified wipe, 138 tests, Aiven PostgreSQL, and bounded Pixel 8 native lifecycle accepted; see [evidence](./impl-plan/m2-offline-trust/off-03-implementation-evidence.md) |
| `OFF-04` Repository and synchronization engine | `COMPLETE` | Engineering | Signed cursors, reset-safe SQLCipher repositories, ordered mutations, critical conflicts, 151 tests, Aiven PostgreSQL, repository gates, and the bounded Pixel 8 lifecycle passed; see [evidence](./impl-plan/m2-offline-trust/off-04-implementation-evidence.md) |
| `OFF-05` Emergency-card vertical slice | `COMPLETE` | Engineering | Dedicated encrypted aggregate, immutable versions, shared sync, SQLCipher V3, accessible standard-access UI, 164 tests, Aiven PostgreSQL, repository gates, and the bounded Pixel 8 lifecycle passed; see [evidence](./impl-plan/m2-offline-trust/off-05-implementation-evidence.md) |
| `OFF-06` Onboarding activation shell | `COMPLETE` | Engineering | Ordered accessible shell, atomic owner/child creation, protected enrollment, shared emergency sync, strict analytics, 179 tests, Aiven gates, Android/iOS exports with validation-bundle containment, bounded Pixel 8 lifecycle, and iOS Simulator activation/Face ID/failure/accessibility/restart/offline evidence passed; see [evidence](./impl-plan/m2-offline-trust/off-06-implementation-evidence.md) |
| M3 through M7 | `NOT STARTED` | See roadmap | Entry gates have not been reached |

`FND-02` was completed by explicit delivery direction ahead of `FND-03`.
`FND-03` added the first application-specific jobs to the accepted task graph.

## 5. Completed Register

| Date | Item | Tag | Evidence and outcome |
| --- | --- | --- | --- |
| 18 Jul 2026 | M0 Gate 0A and engineering close-out | `COMPLETE` | Proceed decision, accepted dependency baseline, decisions `M0-D01` through `M0-D10`, and later-gate obligations are recorded in the M0 dossier |
| 18 Jul 2026 | [`FND-01` monorepo and toolchain](./impl-plan/m1-foundation/fnd-01-implementation-evidence.md) | `COMPLETE` | Root pnpm/Turborepo workspace, 13 package nodes, exact pins, shared configuration, boundary/environment policy, 18 tests, and temporary clean-checkout validation pass |
| 18 Jul 2026 | [`FND-02` CI and supply-chain baseline](./impl-plan/m1-foundation/fnd-02-implementation-evidence.md) | `COMPLETE` | Deterministic GitHub Actions, 23 tooling tests, dependency review, dual secret scanning, scheduled audit, main ruleset, immutable action pins, and source/lockfile traceability pass locally and on pull request #1 |
| 19 Jul 2026 | [`FND-03` application skeletons](./impl-plan/m1-foundation/fnd-03-implementation-evidence.md) | `COMPLETE` | Mobile Expo development-client shell, API Fastify shell, worker heartbeat shell, staff Next.js shell, native configuration transfer, 28 tests, clean Expo Doctor/prebuild/export, root validation, and clean-checkout proof passed |
| 19 Jul 2026 | [`FND-04` contracts and domain kernel](./impl-plan/m1-foundation/fnd-04-implementation-evidence.md) | `COMPLETE` | Zod/OpenAPI source, generated clients, `/v1` metadata routes, framework-independent domain primitives, generated-output drift, breaking-contract guard, 45 tests, root validation, and clean-checkout proof passed |
| 19 Jul 2026 | [`FND-05` database and migration foundation](./impl-plan/m1-foundation/fnd-05-implementation-evidence.md) | `COMPLETE` | Drizzle schema, reviewed SQL migration, tenant context, RLS policy source, audit/idempotency/outbox/change primitives, generated migration drift, API/worker metadata integration, 55 tests, root validation, and clean-checkout proof passed |
| 19 Jul 2026 | [`FND-06` Railway environment skeleton](./impl-plan/m1-foundation/fnd-06-implementation-evidence.md) | `COMPLETE` | Staging-only Railway service descriptors, classified variable/resource manifest, API/staff health checks, live staging project, hosted FND-05 migration, API/worker/staff deployments, production deferral, tests, root validation, and clean-checkout proof passed |
| 19 Jul 2026 | [`FND-07` observability and privacy guards](./impl-plan/m1-foundation/fnd-07-implementation-evidence.md) | `COMPLETE` | Stable safe logs, allowlisted analytics and feature flags, false-default kill switches, Sentry-compatible positive scrubbing, seeded leakage canaries, app adoption, and clean-checkout proof passed |
| 19 Jul 2026 | [`FND-08` design-system prototype reconciliation](./impl-plan/m1-foundation/fnd-08-implementation-evidence.md) | `COMPLETE` | File-by-file disposition, platform-neutral semantic tokens, light/dark/high-contrast Unistyles 3 themes, Typography/Button/Banner, development gallery, 10 focused tests, release exports, root validation, and clean-checkout proof passed |
| 19 Jul 2026 | [`FND-09` ADR and engineering documentation baseline](./impl-plan/m1-foundation/fnd-09-implementation-evidence.md) | `COMPLETE` | Eight accepted foundation ADRs, six task-oriented engineering notes, ADR structure enforcement, context discovery, 95 tests, root validation, and clean-checkout proof passed |
| 20 Jul 2026 | [Gate 1 mobile device and accessibility matrix](./impl-plan/m1-foundation/gate-1-mobile-device-and-accessibility-evidence.md) | `COMPLETE` | Founder-approved iOS-simulator plus physical-Android development clients built, launched, and rendered; foundation reference states passed large-text, contrast, scroll, TalkBack-attachment, and native-semantic checks within the recorded evidence boundaries |
| 20 Jul 2026 | [Gate 1 Aiven PostgreSQL RLS isolation](./impl-plan/m1-foundation/gate-1-aiven-rls-evidence.md) | `COMPLETE` | Fresh temporary database, reviewed migration, two synthetic households, real `littlearc_app` execution, fail-closed no-context reads, cross-household filtering, blocked update, and SQLSTATE `42501` insert rejection passed |
| 20 Jul 2026 | M1 Gate 1 close-out | `COMPLETE` | All Gate 1 criteria have linked passing evidence; M2 work-package planning is ready while real-data and pre-pilot gates remain unchanged |
| 20 Jul 2026 | [`OFF-01` consumer authentication and session lifecycle](./impl-plan/m2-offline-trust/off-01-implementation-evidence.md) | `COMPLETE` | Passwordless OTP policy, PostgreSQL sessions/rate limits, remote revocation, Fastify and SecureStore boundaries, reviewed migration, Aiven lifecycle, 111 tests, root validation, and clean-checkout proof passed; 22 July follow-up added Expo MCP and bounded physical-Android SecureStore/deep-link evidence while live providers and the broader device matrix remain gated |
| 22 Jul 2026 | [`OFF-02` household, parent, child, consent, and audit](./impl-plan/m2-offline-trust/off-02-implementation-evidence.md) | `COMPLETE` | AES-GCM envelope encryption, explicit country and owner/caregiver policy, atomic idempotent onboarding, same-household RLS/FKs, append-only consent/audit, 126 tests, Aiven PostgreSQL, builds, validation, clean-checkout, and bounded Pixel 8 UI/HTTP/database evidence passed |
| 22 Jul 2026 | [`OFF-03` local security and enrollment](./impl-plan/m2-offline-trust/off-03-implementation-evidence.md) | `COMPLETE` | Session-derived authority-neutral enrollment, protected random keys, keyed SQLCipher schema V1, independent AES-GCM files, invalidation recovery, sign-out wipe, 138 tests, Aiven PostgreSQL, repository gates, and bounded Pixel 8 native lifecycle passed |
| 22 Jul 2026 | [`OFF-04` repository and synchronization engine](./impl-plan/m2-offline-trust/off-04-implementation-evidence.md) | `COMPLETE` | Signed cursors, authenticated pull/snapshot/push, atomic encrypted PostgreSQL updates, SQLCipher schema V2 repositories, ordered mutations, critical conflicts, tombstones, reset-safe reconciliation, 151 tests, and the bounded Pixel 8 lifecycle passed |
| 22 Jul 2026 | [`OFF-05` emergency-card vertical slice](./impl-plan/m2-offline-trust/off-05-implementation-evidence.md) | `COMPLETE` | Dedicated encrypted aggregate, immutable versions, explicit clinical states, shared synchronization, SQLCipher schema V3, standard post-unlock UI, 164 tests, Aiven integration, Android/iOS exports, accessibility, and the bounded Pixel 8 offline/dialer/conflict/wipe lifecycle passed |
| 23 Jul 2026 | [`OFF-06` onboarding activation shell](./impl-plan/m2-offline-trust/off-06-implementation-evidence.md) | `COMPLETE` | Seven-step accessible orchestration, atomic owner/child creation, protected SQLCipher enrollment, shared authoritative emergency sync, synthetic first-record preview, bounded analytics, 176 tests, Aiven integration, Android/iOS exports, the bounded Pixel 8 lifecycle, and iOS Simulator activation/Face ID/failure/accessibility/restart/offline follow-up passed |
| 23 Jul 2026 | [iOS Simulator cross-milestone parity validation](./impl-plan/ios-simulator-parity-validation-evidence.md) | `COMPLETE` | All implemented M0/M1/Gate 1/M2 rows through `OFF-06` were classified and validated on the iPhone 17 Pro Simulator or by their owning checks; retained-harness probes, production OFF-01 through OFF-06 flows, API-offline restart, design/accessibility states, Aiven gates, and repository validation passed within explicit physical-iOS limits |
| 24 Jul 2026 | OFF-06 validation-bundle containment | `COMPLETE` | Metro selects the retained synthetic OFF-06 route only for development bundles and a redirect-only implementation for release exports; 179 tests, Android/iOS Hermes scans, root validation, and clean-checkout proof passed |
| 18 Jul 2026 | `RDY-03` M0 taxonomy and data-map baseline | `COMPLETE` | Version 1 planning baseline is recorded; pediatric and privacy approval remains a deferred pre-real-data obligation |
| 18 Jul 2026 | `RDY-04` product decision register | `COMPLETE` | Decisions `M0-D01` through `M0-D10` are accepted; provider-bound verification remains externally gated |
| 18 Jul 2026 | `RDY-05` design-system foundation specification | `COMPLETE` | Component/state direction is accepted as a prototype input; implementation reconciliation belongs to `FND-08` |
| 18 Jul 2026 | `RDY-06` dependency and toolchain snapshot | `COMPLETE` | Frozen install, peer check, TypeScript, Expo Doctor, clean prebuild, and native Android/iOS builds passed with the narrow ML Kit core override |
| 18 Jul 2026 | `RDY-07` M0 native compatibility disposition | `COMPLETE` | Simulator runtime, AES-GCM, SQLCipher, native compilation, and safe unsupported-device scanner behavior passed; physical-device acceptance remains deferred |
| 18 Jul 2026 | `RDY-08` initial threat and control backlog | `COMPLETE` | Initial actors, trust boundaries, threats, controls, owners, and verification targets are recorded; specialist approval remains deferred |
| 18 Jul 2026 | OCR peer-dependency blocker | `COMPLETE` | ML Kit core is narrowly overridden to corrected version 5.0.0; obsolete React 17-era test dependencies are absent from the runtime graph |
| 18 Jul 2026 | Native harness accessibility baseline | `COMPLETE` | Large text, dark appearance, and increased contrast rendered without fixed-height or navigation failure; physical assistive-technology testing remains deferred |
| 18 Jul 2026 | M0 spike generated-output cleanup | `COMPLETE` | Removed regenerable `node_modules/`, `android/`, `ios/`, `dist/`, and `.expo/`; retained source, lockfile, configuration, and evidence instructions |
| 19 Jul 2026 | Codex context structure rollout | `COMPLETE` | Global working agreements, repository context index, context map/search, documentation validation, selective module guides, reusable project template, and repo-local skills are installed; full validation and clean-checkout proof passed |

## 6. In-Progress Register

M2 remains open at the milestone level because Gate 2 is not closed. No
individual work package is currently in progress.

## 7. Ready Queue

No additional work package is ready. M3 remains gated by Gate 2.

The complete dependency order remains in Section 25 of the implementation
roadmap. This section should show only the next few actionable packages.

## 8. Blockers and Later-Gate Obligations

| Item | Tag | Blocks | Owner | Resolution trigger |
| --- | --- | --- | --- | --- |
| Representative-parent research and five-flow validation (`RDY-01`, `RDY-02`) | `DEFERRED` | Invited pilot and product-direction claims; not synthetic M1 work | Founder/product + design | Required cohorts and five critical flows meet the recorded thresholds |
| Pediatric terminology and safety approval (`RDY-03`) | `DEFERRED` | Real-data/pilot approval for clinical terminology and schedule behavior | Product + pediatric advisor | Specialist review is recorded against the taxonomy and safety copy |
| Privacy/legal and security specialist approval (`RDY-08`) | `DEFERRED` | Real child data and invited pilot | Founder + privacy/legal + security | Required reviews approve consent, verification, processors, retention, deletion, incident handling, and controls |
| Pre-pilot physical-device capability matrix | `DEFERRED` | Pilot distribution and claims beyond the accepted Gate 1 iOS-simulator plus physical-Android foundation matrix | Engineering | Physical iOS plus required Android coverage passes scanner, OCR, biometrics, imports, notifications, assistive-technology, signing/install, and upgrade checks |
| Organization-owned provider, store, signing, and custody setup (`RDY-09`) | `BLOCKED` | Account-bound authentication, signed pilot distribution, and live recovery verification | Founder + engineering | Entity/accounts, credentials, signing access, live cost/capability checks, and recovery ownership are available and verified |
| Real child or participant data | `BLOCKED` | Any real-data collection, storage, processing, or pilot use | Founder/product | Every named pre-real-data privacy, safety, security, provider, deletion, backup, and incident gate passes |
| Native compatibility harness retirement | `DEFERRED` | Harness source retirement only; does not block accepted M1 packages | Engineering | Transfer or close its remaining physical-device evidence and review the root OCR override under [ADR-0002](./adr/0002-expo-native-development-and-spike-disposition.md) |
| Local Aiven PostgreSQL target-version alignment | `DEFERRED` | PostgreSQL 18-specific local-development claims; not M2 planning or the accepted Gate 1 RLS behavior | Engineering | Upgrade the Aiven development service from reported PostgreSQL 17.10 to 18 and rerun provider integration before relying on version-18-only behavior |

## 9. Retained Artifacts and Follow-Up Debt

| Artifact or debt | Tag | Reason retained | Retirement or resolution condition |
| --- | --- | --- | --- |
| `spikes/native-compat` source harness | `RETAINED` | Reproducible M0 evidence for unresolved physical-device scenarios; production configuration now belongs to `apps/mobile` | Meet the ADR-0002 harness-retirement trigger in Section 8 |
| ML Kit core 5.0.0 pnpm override | `RETAINED` | Resolves the OCR wrapper's invalid React 17-era runtime dependency graph | Remove only when the wrapper publishes a compatible core dependency and all native checks remain green |
| Moderate `uuid` advisory in retained M0 harness | `DEFERRED` | The alert remains visible; automatic update returned `security_update_not_possible` because the transitive major is constrained, while the root production audit is clean | Reassess at the next harness dependency review and remove with harness retirement |
| Renovate GitHub App authorization | `DEFERRED` | Validated configuration is committed; interactive App authorization was unavailable in this session and is not a CI baseline blocker | Install from the Renovate GitHub App page and confirm its dependency dashboard |
| Production Railway environment skeleton | `DEFERRED` | Founder directed `FND-06` to staging only for now | Reopen a separate production setup package before real-data gates |
| `openapi-typescript` TypeScript peer metadata | `DEFERRED` | Version 7.13.0 declares TypeScript `^5.x` while the accepted root pin is 6.0.3; generation, typechecks, builds, and clean-checkout validation pass | Recheck on the next OpenAPI/toolchain upgrade and remove only after the supported peer range includes the selected root compiler |

## 10. Implementation Plans

| Plan | Status | Evidence |
| --- | --- | --- |
| [Roadmap](./impl-plan/roadmap.md) | `ACCEPTED` | Live status tracked in this dashboard |
| [`FND-01` Monorepo and toolchain](./impl-plan/m1-foundation/fnd-01-monorepo-and-toolchain-plan.md) | `COMPLETE` | [Evidence](./impl-plan/m1-foundation/fnd-01-implementation-evidence.md) |
| [`FND-02` CI and supply-chain baseline](./impl-plan/m1-foundation/fnd-02-ci-and-supply-chain-plan.md) | `COMPLETE` | [Evidence](./impl-plan/m1-foundation/fnd-02-implementation-evidence.md) |
| [`FND-03` Application skeletons](./impl-plan/m1-foundation/fnd-03-application-skeletons-plan.md) | `COMPLETE` | [Evidence](./impl-plan/m1-foundation/fnd-03-implementation-evidence.md) |
| [`FND-04` Contracts and domain kernel](./impl-plan/m1-foundation/fnd-04-contracts-and-domain-kernel-plan.md) | `COMPLETE` | [Evidence](./impl-plan/m1-foundation/fnd-04-implementation-evidence.md) |
| [`FND-05` Database and migration foundation](./impl-plan/m1-foundation/fnd-05-database-and-migration-foundation-plan.md) | `COMPLETE` | [Evidence](./impl-plan/m1-foundation/fnd-05-implementation-evidence.md) |
| [`FND-06` Railway environment skeleton](./impl-plan/m1-foundation/fnd-06-railway-environment-skeleton-plan.md) | `COMPLETE` | [Evidence](./impl-plan/m1-foundation/fnd-06-implementation-evidence.md) |
| [`FND-07` Observability and privacy guards](./impl-plan/m1-foundation/fnd-07-observability-and-privacy-guards-plan.md) | `COMPLETE` | [Evidence](./impl-plan/m1-foundation/fnd-07-implementation-evidence.md) |
| [`FND-08` Design-system prototype reconciliation](./impl-plan/m1-foundation/fnd-08-design-system-prototype-reconciliation-plan.md) | `COMPLETE` | [Evidence](./impl-plan/m1-foundation/fnd-08-implementation-evidence.md) |
| [`FND-09` ADR and engineering documentation baseline](./impl-plan/m1-foundation/fnd-09-adr-and-engineering-documentation-baseline-plan.md) | `COMPLETE` | [Evidence](./impl-plan/m1-foundation/fnd-09-implementation-evidence.md) |
| [Gate 1 mobile device and accessibility matrix](./impl-plan/m1-foundation/gate-1-mobile-device-and-accessibility-evidence.md) | `COMPLETE` | Accepted only for the recorded Gate 1 platform matrix; broader physical-device checks remain pre-pilot |
| [Gate 1 Aiven PostgreSQL RLS isolation](./impl-plan/m1-foundation/gate-1-aiven-rls-evidence.md) | `COMPLETE` | Real PostgreSQL execution proves the remaining seeded cross-household Gate 1 criterion |
| [`OFF-01` Consumer authentication and session lifecycle](./impl-plan/m2-offline-trust/off-01-consumer-authentication-and-session-lifecycle-plan.md) | `COMPLETE` | [Evidence](./impl-plan/m2-offline-trust/off-01-implementation-evidence.md) |
| [`OFF-02` Household, parent, child, consent, and audit](./impl-plan/m2-offline-trust/off-02-household-parent-child-consent-and-audit-plan.md) | `COMPLETE` | [Evidence](./impl-plan/m2-offline-trust/off-02-implementation-evidence.md) |
| [`OFF-03` Local security and enrollment](./impl-plan/m2-offline-trust/off-03-local-security-and-enrollment-plan.md) | `COMPLETE` | [Evidence](./impl-plan/m2-offline-trust/off-03-implementation-evidence.md) |
| [`OFF-04` Repository and synchronization engine](./impl-plan/m2-offline-trust/off-04-repository-and-synchronization-engine-plan.md) | `COMPLETE` | [Evidence](./impl-plan/m2-offline-trust/off-04-implementation-evidence.md) |
| [`OFF-05` Emergency-card vertical slice](./impl-plan/m2-offline-trust/off-05-emergency-card-vertical-slice-plan.md) | `COMPLETE` | [Evidence](./impl-plan/m2-offline-trust/off-05-implementation-evidence.md) |
| [`OFF-06` Onboarding activation shell](./impl-plan/m2-offline-trust/off-06-onboarding-activation-shell-plan.md) | `COMPLETE` | [Evidence](./impl-plan/m2-offline-trust/off-06-implementation-evidence.md) |

## 11. Agent Workflow

1. Open this dashboard first.
2. Open [docs/index.md](./index.md) and select only task-relevant context.
3. Use [docs/context-map.yaml](./context-map.yaml) or
   `./scripts/context/find-context.sh "<query>"` for focused context discovery.
4. Select the next `READY` or `IN PROGRESS` work package.
5. Open the linked implementation plan and confirm its status header.
6. Update the implementation plan's module-status table as module-level progress changes.
7. Add or update evidence only after validation passes.
8. Return here last and update the snapshot, registers, blockers, and plan links.
9. Create an ADR only for important decisions that affect structure, quality attributes, operational policy, or difficult-to-reverse choices.

## 12. Update Protocol

For every status change:

1. Update the item's tag, owner, and next action in this file.
2. Add a dated completion row only after its acceptance evidence exists.
3. Move unresolved obligations into Section 8 with the exact gate they block.
4. Link detailed evidence instead of copying large logs into this tracker.
5. Update the roadmap only when scope, order, dependency, or gate definitions
   change—not for routine progress.
6. Never mark an item `COMPLETE` when only its implementation is written;
   required validation and evidence must also pass.
7. Keep the matching implementation plan's status header and module-status
   table in sync with this dashboard.

`OFF-06` is complete within its synthetic physical-Android plus iOS-Simulator
development-client boundary. M2 and Gate 2 remain open until two-device
conflict, full assistive-technology/low-end coverage, and every other
unproven named gate criterion have passing evidence. The quick-access,
real-provider, real-data, physical-iOS, and broader pre-pilot gates remain
unchanged.

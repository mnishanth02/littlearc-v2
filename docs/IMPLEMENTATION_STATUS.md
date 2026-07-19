# LittleArc Implementation Status

> **Status:** Active delivery dashboard
> **Version:** 1.0
> **Last updated:** 19 July 2026
> **Execution plan:** [Implementation Plan and Roadmap](./impl-plan/roadmap.md)
> **Core documents:** [Product plan](./core/littlearc-complete-product-plan.md),
> [architecture](./core/littlearc-architecture-and-tech-stack.md),
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
| Core | Foundational product, architecture, design, and readiness decisions | [`docs/core/`](./core/) |
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
| M1. Engineering foundation | `IN PROGRESS` | Engineering | Start `FND-03` on the accepted repository and CI foundation |
| `FND-01` Monorepo and toolchain | `COMPLETE` | Engineering | Root workspace, boundaries, exact pins, and clean-checkout proof accepted; see [evidence](./impl-plan/m1-foundation/fnd-01-implementation-evidence.md) |
| `FND-03` Application skeletons | `READY` | Engineering | Write the package brief, then scaffold the four application runtimes |
| `FND-02` CI and supply-chain baseline | `COMPLETE` | Engineering | Local and hosted validation, required PR checks, source traceability, and repository controls accepted; see [evidence](./impl-plan/m1-foundation/fnd-02-implementation-evidence.md) |
| `FND-04` through `FND-09` | `NOT STARTED` | See roadmap | Pull in dependency order |
| M2 through M7 | `NOT STARTED` | See roadmap | Entry gates have not been reached |

`FND-02` was completed by explicit delivery direction ahead of `FND-03`.
Application-specific jobs will enter the accepted task graph when `FND-03`
adds them.

## 5. Completed Register

| Date | Item | Tag | Evidence and outcome |
| --- | --- | --- | --- |
| 18 Jul 2026 | M0 Gate 0A and engineering close-out | `COMPLETE` | Proceed decision, accepted dependency baseline, decisions `M0-D01` through `M0-D10`, and later-gate obligations are recorded in the M0 dossier |
| 18 Jul 2026 | [`FND-01` monorepo and toolchain](./impl-plan/m1-foundation/fnd-01-implementation-evidence.md) | `COMPLETE` | Root pnpm/Turborepo workspace, 13 package nodes, exact pins, shared configuration, boundary/environment policy, 18 tests, and temporary clean-checkout validation pass |
| 18 Jul 2026 | [`FND-02` CI and supply-chain baseline](./impl-plan/m1-foundation/fnd-02-implementation-evidence.md) | `COMPLETE` | Deterministic GitHub Actions, 23 tooling tests, dependency review, dual secret scanning, scheduled audit, main ruleset, immutable action pins, and source/lockfile traceability pass locally and on pull request #1 |
| 18 Jul 2026 | `RDY-03` M0 taxonomy and data-map baseline | `COMPLETE` | Version 1 planning baseline is recorded; pediatric and privacy approval remains a deferred pre-real-data obligation |
| 18 Jul 2026 | `RDY-04` product decision register | `COMPLETE` | Decisions `M0-D01` through `M0-D10` are accepted; provider-bound verification remains externally gated |
| 18 Jul 2026 | `RDY-05` design-system foundation specification | `COMPLETE` | Component/state direction is accepted as a prototype input; implementation reconciliation belongs to `FND-08` |
| 18 Jul 2026 | `RDY-06` dependency and toolchain snapshot | `COMPLETE` | Frozen install, peer check, TypeScript, Expo Doctor, clean prebuild, and native Android/iOS builds passed with the narrow ML Kit core override |
| 18 Jul 2026 | `RDY-07` M0 native compatibility disposition | `COMPLETE` | Simulator runtime, AES-GCM, SQLCipher, native compilation, and safe unsupported-device scanner behavior passed; physical-device acceptance remains deferred |
| 18 Jul 2026 | `RDY-08` initial threat and control backlog | `COMPLETE` | Initial actors, trust boundaries, threats, controls, owners, and verification targets are recorded; specialist approval remains deferred |
| 18 Jul 2026 | OCR peer-dependency blocker | `COMPLETE` | ML Kit core is narrowly overridden to corrected version 5.0.0; obsolete React 17-era test dependencies are absent from the runtime graph |
| 18 Jul 2026 | Native harness accessibility baseline | `COMPLETE` | Large text, dark appearance, and increased contrast rendered without fixed-height or navigation failure; physical assistive-technology testing remains deferred |
| 18 Jul 2026 | M0 spike generated-output cleanup | `COMPLETE` | Removed regenerable `node_modules/`, `android/`, `ios/`, `dist/`, and `.expo/`; retained source, lockfile, configuration, and evidence instructions |

## 6. In-Progress Register

No implementation item is currently tagged `IN PROGRESS`.

## 7. Ready Queue

| Priority | Item | Tag | Entry condition | Definition of done |
| ---: | --- | --- | --- | --- |
| 1 | `FND-03` Application skeletons | `READY` | `FND-01` foundation available | Mobile, API, worker, and staff shells run; accepted native configuration is transferred into `apps/mobile` |

The complete dependency order remains in Section 25 of the implementation
roadmap. This table should show only the next few actionable packages.

## 8. Blockers and Later-Gate Obligations

| Item | Tag | Blocks | Owner | Resolution trigger |
| --- | --- | --- | --- | --- |
| Representative-parent research and five-flow validation (`RDY-01`, `RDY-02`) | `DEFERRED` | Invited pilot and product-direction claims; not synthetic M1 work | Founder/product + design | Required cohorts and five critical flows meet the recorded thresholds |
| Pediatric terminology and safety approval (`RDY-03`) | `DEFERRED` | Real-data/pilot approval for clinical terminology and schedule behavior | Product + pediatric advisor | Specialist review is recorded against the taxonomy and safety copy |
| Privacy/legal and security specialist approval (`RDY-08`) | `DEFERRED` | Real child data and invited pilot | Founder + privacy/legal + security | Required reviews approve consent, verification, processors, retention, deletion, incident handling, and controls |
| Physical iOS and Android device matrix | `DEFERRED` | Pilot distribution and Gate 1 physical-device criterion; not initial synthetic scaffold work | Engineering | Scanner, OCR, biometrics, imports, notifications, accessibility gestures, install, and upgrade evidence passes on required devices |
| Organization-owned provider, store, signing, and custody setup (`RDY-09`) | `BLOCKED` | Account-bound authentication, signed pilot distribution, and live recovery verification | Founder + engineering | Entity/accounts, credentials, signing access, live cost/capability checks, and recovery ownership are available and verified |
| Real child or participant data | `BLOCKED` | Any real-data collection, storage, processing, or pilot use | Founder/product | Every named pre-real-data privacy, safety, security, provider, deletion, backup, and incident gate passes |
| Native compatibility harness retirement | `BLOCKED` | Deletion of `spikes/native-compat`; does not block M1 | Engineering | `FND-03` transfers the accepted native configuration, real `apps/mobile` passes clean iOS/Android builds, any OCR override moves to the root workspace, and an ADR records the final dependency decision |

## 9. Retained Artifacts and Follow-Up Debt

| Artifact or debt | Tag | Reason retained | Retirement or resolution condition |
| --- | --- | --- | --- |
| `spikes/native-compat` source harness | `RETAINED` | Reproducible M0 native configuration and OCR workaround evidence | Meet the harness-retirement trigger in Section 8 |
| ML Kit core 5.0.0 pnpm override | `RETAINED` | Resolves the OCR wrapper's invalid React 17-era runtime dependency graph | Remove only when the wrapper publishes a compatible core dependency and all native checks remain green |
| Long probe-screen title wrapping | `DEFERRED` | Structural accessibility passed; visual wrapping needs product UI treatment | Resolve during `FND-08` component and typography reconciliation |
| Moderate `uuid` advisory in retained M0 harness | `DEFERRED` | The alert remains visible; automatic update returned `security_update_not_possible` because the transitive major is constrained, while the root production audit is clean | Reassess during `FND-03` transfer and remove with harness retirement |
| Renovate GitHub App authorization | `DEFERRED` | Validated configuration is committed; interactive App authorization was unavailable in this session and is not a CI baseline blocker | Install from the Renovate GitHub App page and confirm its dependency dashboard |

## 10. Implementation Plans

| Plan | Status | Evidence |
| --- | --- | --- |
| [Roadmap](./impl-plan/roadmap.md) | `ACCEPTED` | Live status tracked in this dashboard |
| [`FND-01` Monorepo and toolchain](./impl-plan/m1-foundation/fnd-01-monorepo-and-toolchain-plan.md) | `COMPLETE` | [Evidence](./impl-plan/m1-foundation/fnd-01-implementation-evidence.md) |
| [`FND-02` CI and supply-chain baseline](./impl-plan/m1-foundation/fnd-02-ci-and-supply-chain-plan.md) | `COMPLETE` | [Evidence](./impl-plan/m1-foundation/fnd-02-implementation-evidence.md) |

## 11. Agent Workflow

1. Open this dashboard first.
2. Select the next `READY` or `IN PROGRESS` work package.
3. Open the linked implementation plan and confirm its status header.
4. Update the implementation plan's module-status table as module-level progress changes.
5. Add or update evidence only after validation passes.
6. Return here last and update the snapshot, registers, blockers, and plan links.
7. Create an ADR only for important decisions that affect structure, quality attributes, operational policy, or difficult-to-reverse choices.

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

The next status change should be `FND-03`: `READY` to `IN PROGRESS` when
its package brief and implementation begin.

# iOS Simulator Cross-Milestone Parity Validation

> **Status:** Complete
> **Last updated:** 23 July 2026
> **Owner:** Engineering
> **Scope:** `RDY-01` through `RDY-09`, `FND-01` through `FND-09`,
> Gate 1, and `OFF-01` through `OFF-06`

---

## Outcome

Produce one current, reproducible iOS Simulator validation record for every
implemented LittleArc work package through `OFF-06`. Exercise every
device-applicable Android acceptance path in the iOS custom development client,
rerun supporting automated and native-build checks, fix cross-platform defects
found by the pass, and record non-device or simulator-impossible criteria
without presenting them as passed.

This is a validation follow-up, not a new milestone or a change to roadmap
ordering. Historical M0 and Gate 1 records already contain bounded iOS
Simulator evidence. This pass refreshes those paths and adds the missing
cross-platform coverage for the M2 validation routes.

## Evidence Rules

- Use synthetic fixtures only. Do not use real child, household, medical, or
  participant information.
- Use the production mobile application for M1 and M2 behavior. Use the retained
  `spikes/native-compat` application only for the M0 native-package probes it
  still owns.
- Use custom development clients because SQLCipher, protected SecureStore,
  scanner/OCR, and other native modules are outside Expo Go's evidence boundary.
- Treat simulated Face ID as simulator API and integration evidence, not as
  physical Secure Enclave or real-biometric evidence.
- Treat a safe scanner cancellation or unavailable-camera state as simulator
  behavior, not as camera/OCR accuracy evidence.
- Record successful system handoff to an iOS dialer surface without placing a
  real call.
- Keep physical iOS, VoiceOver on physical hardware, real camera/OCR,
  notification delivery on a physical phone, signing/TestFlight, upgrade,
  low-memory performance, two-device conflict, and real-provider/data checks
  open at their existing gates.
- Do not rerun browser, API, worker, database, Railway, CI, product-research, or
  document-only behavior “in the simulator.” Rerun its owning automated check
  where it supports the mobile flow and mark the simulator dimension not
  applicable.

## Coverage Matrix

| Package | iOS Simulator validation | Supporting validation | Expected classification |
| --- | --- | --- | --- |
| `RDY-01` research operations | None; requires representative participants | Documentation/link consistency | Not simulator-applicable; remains deferred |
| `RDY-02` critical-flow prototype validation | No representative-user claim | Current implemented flows exercised under their owning packages | Not simulator-applicable; remains deferred |
| `RDY-03` taxonomy and data map | Confirm synthetic labels/states used by implemented screens | Documentation and domain tests | Runtime-consumed subset plus non-device evidence |
| `RDY-04` product decisions | Confirm implemented onboarding/emergency boundaries do not contradict accepted decisions | Documentation consistency | Runtime-consumed subset plus non-device evidence |
| `RDY-05` design-system foundation | Production gallery at default, dark, increased contrast, and maximum Dynamic Type | Design-token/component tests | Simulator-applicable |
| `RDY-06` dependency/toolchain snapshot | Fresh native iOS build/install/launch | Frozen install, peer check, typecheck, Expo Doctor, prebuild/export | Simulator plus automated/native evidence |
| `RDY-07` native compatibility | Retained harness: runtime/auth/deep link, AES-GCM, SQLCipher, simulated Face ID/protected SecureStore, scanner safe path, imports, and local notification request/scheduling | Harness typecheck, Doctor, prebuild/build | Simulator-applicable with hardware limits recorded |
| `RDY-08` threat/privacy kickoff | Confirm synthetic boundaries and inspect bounded runtime logs for seeded sensitive-value leakage | Observability/privacy tests and docs | Runtime-consumed subset plus non-device evidence |
| `RDY-09` Railway/store capability | None for organization accounts, store signing, cost, or custody | Existing documentation checks only | Not simulator-applicable; remains blocked/deferred |
| `FND-01` monorepo/toolchain | Current development client consumes the accepted workspace | Workspace, format, typecheck, validation, clean-checkout checks | Simulator-consumed plus automated evidence |
| `FND-02` CI/supply chain | None | Local CI-equivalent checks and dependency audit | Not simulator-applicable |
| `FND-03` application skeletons | Mobile shell build/install/launch, navigation, status, and error-safe render | API, worker, staff, mobile builds/exports | Mobile subset plus automated evidence |
| `FND-04` contracts/domain kernel | M2 routes exercise generated contracts and domain identifiers | Contract, generated-drift, domain tests | Simulator-consumed plus automated evidence |
| `FND-05` database/migrations | M2 routes exercise API/database integration; no database executes inside the simulator | Disposable Aiven PostgreSQL suites and migration checks | Simulator-consumed plus database evidence |
| `FND-06` Railway environments | Verify the mobile environment/status surface without claiming local simulator traffic is staging proof | Existing/live-health evidence and environment tests as available | Mobile subset; Railway itself not simulator-applicable |
| `FND-07` observability/privacy guards | Exercise mobile bootstrap and validation events; inspect logs for synthetic-sensitive canaries | Observability and leakage tests | Simulator-applicable subset |
| `FND-08` design-system reconciliation | Full development gallery, semantics, scrolling, themes, contrast, and Dynamic Type | Component/accessibility tests and release-bundle gallery exclusion | Simulator-applicable |
| `FND-09` ADR/documentation baseline | None | Context lookup and documentation governance | Not simulator-applicable |
| Gate 1 mobile/accessibility | Fresh custom-client build/install/launch and gallery stress pass | Root/native checks | Simulator-applicable within accepted Gate 1 matrix |
| Gate 1 PostgreSQL RLS | No database executes inside the simulator | Disposable Aiven RLS suite | Not simulator-applicable; database evidence required |
| `OFF-01` authentication/session lifecycle | Better Auth client init, SecureStore write/read/delete, and deep-link route | Auth/API/database and root tests | Simulator-applicable subset; live providers remain open |
| `OFF-02` household/consent/audit | Privacy, adult verification, consent, review, atomic submit, completion, and exact disposable-database evidence | OFF-02 database harness and root tests | Simulator-applicable with synthetic boundary |
| `OFF-03` local security/enrollment | Capability, enrollment, simulated biometric unlock, wrong-key/AAD/tamper rejection, invalidation recovery/resync, and sign-out wipe | OFF-03 database harness and root tests | Simulator-applicable with simulated-biometric boundary |
| `OFF-04` repository/synchronization | Enrollment, initial reset, offline optimistic edit, reconnect push, idempotent replay, conflict, tombstone, reset/restart retention, and wipe | OFF-04 database harness and sync tests | Simulator-applicable with server-simulated second writer |
| `OFF-05` emergency card | Creation/sync, production route, API-offline process restart/read, selectable facts, deliberate dialer handoff, stale conflict, accessibility stress, evidence, and wipe | OFF-05 database harness and root tests | Simulator-applicable; no real call or physical quick-access claim |
| `OFF-06` onboarding activation shell | Reconfirm full seven-step activation, simulated Face ID, API failure/retry, exact database counts, accessibility, restart, and API-offline SQLCipher read | OFF-06 database harness and root tests | Simulator-applicable within existing boundary |

## Implementation Plan

1. Inventory the accepted M0, M1, Gate 1, and M2 criteria and map every prior
   Android/device observation to an iOS Simulator action, supporting automated
   action, or explicit not-applicable/deferred result.
2. Remove Android-only assumptions from shared M2 validation routes and
   disposable API harness identities. Use the runtime platform in enrollment
   requests and platform-neutral validation labels without changing production
   contracts.
3. Add any missing development-only navigation needed to reach an existing
   validation route. Keep all validation routes hidden from non-development
   builds.
4. Regenerate and run the retained M0 native harness on the booted simulator.
   Exercise every probe, capture exact outcomes, and preserve hardware
   limitations.
5. Build/install the current production iOS custom development client. Exercise
   the M1 shell, environment/status surface, design-system gallery, themes,
   contrast, Dynamic Type, scrolling, and native semantics.
6. Run `OFF-01` through `OFF-06` sequentially with their disposable Aiven
   harnesses. For offline/restart cases, stop the owning API process rather than
   relying on a global network change that could affect unrelated applications.
7. Inspect simulator/app/API logs only for LittleArc-owned processes. Verify no
   fatal native/JavaScript failures or seeded sensitive-value leakage.
8. Run focused tests first, followed by database integration, generated-output
   checks, Expo Doctor, iOS and Android exports, root validation, and the
   clean-checkout proof where practical.
9. Write one consolidated evidence dossier and add precise follow-up notes to
   the affected package evidence. Update the status dashboard, documentation
   indexes/context map, and roadmap evidence links without changing gate
   definitions.

## Acceptance Criteria

- Every row in the coverage matrix has a dated result of passed,
  not-applicable, deferred/blocked, or failed; no row is silently omitted.
- Every device-applicable Android path through `OFF-05` has an equivalent iOS
  Simulator run, and `OFF-06` is freshly reconfirmed.
- Shared validation source no longer claims an Android platform while running
  on iOS.
- The M0 retained harness and production M1/M2 app both build, install, launch,
  and render on the recorded simulator and custom-development-client versions.
- Default and stressed accessibility states remain reachable without
  horizontal loss, clipped fixed-height actions, or navigation failure.
- Supporting automated, database, build/export, documentation, and
  clean-checkout validations are reported with exact pass/fail/not-run results.
- The evidence distinguishes iOS Simulator proof from physical iOS, real
  biometrics/Secure Enclave, real camera/OCR, physical notification delivery,
  real provider/data, and two-device proof.

## Review Checklist

- [x] Package scope reconciled against the roadmap and delivery dashboard.
- [x] Prior Android/device evidence mapped to a same-flow iOS action.
- [x] M0 retained-harness ownership separated from production mobile ownership.
- [x] Non-device and simulator-impossible checks explicitly classified.
- [x] Synthetic-data and physical-iOS evidence boundaries preserved.
- [x] Documentation validation passes with the plan linked from discovery
  surfaces.
- [x] Plan status is finalized before source implementation begins.

## Evidence

Implementation evidence is recorded in the
[iOS Simulator cross-milestone evidence dossier](./ios-simulator-parity-validation-evidence.md).

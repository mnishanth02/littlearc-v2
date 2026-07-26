# iOS Simulator Cross-Milestone Parity Evidence

> **Status:** Complete
> **Evidence date:** 23 July 2026
> **Last updated:** 23 July 2026
> **Owner:** Engineering
> **Plan:** [iOS Simulator Cross-Milestone Parity Validation](./ios-simulator-parity-validation-plan.md)
> **Scope:** `RDY-01` through `RDY-09`, `FND-01` through `FND-09`,
> Gate 1, and `OFF-01` through `OFF-06`

---

## 1. Decision

**Decision: PASS within the recorded iOS Simulator boundary.** Every completed
roadmap package through `OFF-06` now has a dated iOS Simulator result, an
owning automated result, or an explicit not-applicable/deferred result. The
production LittleArc custom development client passed the complete implemented
mobile flow. The retained M0 harness passed every simulator-capable native
probe.

This result does not close physical-iOS, real-biometric/Secure Enclave,
camera/OCR, physical-notification, VoiceOver-on-iPhone, TestFlight/signing,
real-provider/data, low-end, or two-device evidence.

## 2. Environment

| Item | Observed value |
| --- | --- |
| Host toolchain | macOS; Xcode 26.5 (`17F42`) |
| Simulator | iPhone 17 Pro (`iPhone18,1`) |
| Simulator OS | iOS 26.5 |
| Simulator UDID | `7C8183EE-08E8-4F3D-A064-D3C404A10CC9` |
| Production bundle | `app.littlearc.mobile` |
| Retained M0 bundle | `com.littlearc.spike.nativecompat` |
| JavaScript toolchain | Node.js 24.18.0; pnpm 11.14.0 |
| Data boundary | Fixed synthetic fixtures and disposable Aiven databases only |

The installed applications, Simulator, Metro, API validation processes, and
disposable databases were LittleArc-owned validation targets. No unrelated
application, account, notification, file, clipboard, or device data was
opened.

## 3. Complete Coverage Matrix

| Package | Result | iOS Simulator or owning evidence |
| --- | --- | --- |
| `RDY-01` research operations | Deferred | Representative-participant research is not simulator-applicable and remains at its existing gate. |
| `RDY-02` prototype validation | Deferred | Representative-user validation is not replaced by implemented-flow smoke tests. |
| `RDY-03` taxonomy/data map | Pass, bounded subset | Implemented consent, explicit clinical-state, emergency, and synthetic labels rendered consistently; domain/docs checks own the wider taxonomy. |
| `RDY-04` product decisions | Pass, bounded subset | Onboarding and emergency routes preserved the accepted synthetic-only, standard post-unlock, and preview-only boundaries. |
| `RDY-05` design-system foundation | Pass | The production gallery rendered in light, dark, increased-contrast, and maximum accessibility content-size states. |
| `RDY-06` dependency/toolchain | Pass | Accepted pinned Expo packages, frozen installs, Doctor, prebuild, current custom clients, and native launch were reconfirmed. |
| `RDY-07` native compatibility | Pass with hardware limits | The retained harness passed runtime/auth, AES-GCM, SQLCipher, simulated Face ID/protected SecureStore, document cancellation, synthetic photo import, and local-notification scheduling. Scanner/OCR correctly reported that the Simulator has no supported camera. |
| `RDY-08` threat/privacy kickoff | Pass, bounded subset | Every mobile flow retained visible synthetic-data warnings; LittleArc-owned runtime/API logs contained only synthetic validation identifiers and bounded evidence. Automated observability/privacy guards passed. |
| `RDY-09` Railway/store capability | Deferred | Organization accounts, store custody, signing, cost, and Railway capability are not simulator-applicable. |
| `FND-01` monorepo/toolchain | Pass | The installed production client consumed the accepted workspace; root workspace/format/type/build/validation checks passed. |
| `FND-02` CI/supply chain | Not simulator-applicable; automated pass | Local CI-equivalent and audit checks own this package. No CI system executes in Simulator. |
| `FND-03` application skeletons | Pass, mobile subset | Development-client launch, Expo Router navigation, landing shell, runtime status, not-found recovery, and M2 route entry passed without a native or JavaScript crash. |
| `FND-04` contracts/domain | Pass, consumed plus automated | OFF-02 through OFF-06 exercised generated contracts and UUID/domain rules; generated-drift and package tests passed. |
| `FND-05` database/migrations | Pass, consumed plus database | Mobile API/database paths passed; disposable Aiven suites own database execution and passed independently. |
| `FND-06` Railway environments | Pass, local mobile subset | The runtime surface correctly reported the local API origin. Railway infrastructure itself was not reclassified as simulator evidence. |
| `FND-07` observability/privacy | Pass, mobile subset | Mobile bootstrap and coarse onboarding milestones ran without fatal logging or seeded sensitive-value leakage; package tests passed. |
| `FND-08` design-system reconciliation | Pass | Gallery typography, actions, banners, semantic themes, high contrast, and vertical Dynamic Type reflow remained renderable and navigable. |
| `FND-09` docs/ADR baseline | Not simulator-applicable; docs pass | Documentation governance and focused context lookup own this package. |
| Gate 1 mobile/accessibility | Pass | A current custom client launched and rendered; default, dark, increased-contrast, and maximum accessibility content-size reference states passed within the accepted Simulator matrix. |
| Gate 1 PostgreSQL RLS | Not simulator-applicable; database pass | PostgreSQL 17.10 disposable-database proof passed fail-closed context, tenant filtering, blocked cross-household update, and SQLSTATE `42501` insert rejection. |
| `OFF-01` auth/session | Pass, bounded subset | Better Auth client initialization, SecureStore write/read/delete, and the `littlearc` deep-link scheme passed. Live identity providers remain open. |
| `OFF-02` household/consent | Pass | Privacy, verification, required consent, review, atomic submit, exact database evidence, and safe synthetic completion passed. |
| `OFF-03` local security | Pass with simulated-biometric boundary | Strong-biometric capability, enrollment, SQLCipher V3, matching simulated Face ID unlock, wrong-key/AAD/tamper rejection, invalidation recovery/re-enrollment, resync, and sign-out wipe passed. |
| `OFF-04` synchronization | Pass | Initial reset/snapshot, offline queue, push/pull, exact replay, stale conflict, tombstone, cursor expiry/reset, process restart, retained SQLCipher resume, discard warning, and wipe passed. The second writer was server-simulated. |
| `OFF-05` emergency card | Pass with Simulator handoff limit | Create/sync, production read, controlled API outage, real process restart, API-offline SQLCipher resume, conflict, two immutable versions, minimized evidence, discard, and wipe passed. iOS emitted the expected “Phone app unavailable in Simulator” warning for `tel:`; real dialer launch remains physical-iPhone evidence. |
| `OFF-06` onboarding shell | Pass | All seven ordered steps, atomic household/consent, protected enrollment, emergency-card version 1, preview-only first record, and exact one-household/one-child/two-consent/one-device/one-card/one-version counts passed. The same final source also has same-day API-down retry, simulated Face ID, accessibility, restart, and API-offline SQLCipher evidence in the package dossier. |

## 4. Native and Product Flow Evidence

### 4.1 Retained M0 harness

The regenerated M0 custom development client built, installed, launched, and
completed all eight probes:

1. runtime configuration, authentication initialization, and deep linking;
2. AES-GCM round trip plus wrong-AAD rejection;
3. SQLCipher 4.7.0 Community with WAL and encrypted persistence;
4. enrolled/matching simulated Face ID plus protected SecureStore;
5. bounded unsupported-camera result for scanner/OCR;
6. safe document-picker cancellation;
7. one fixed synthetic photo-library import; and
8. generic local-notification scheduling.

The scanner/OCR result is a correct Simulator capability result, not physical
camera or text-recognition evidence. Notification scheduling does not prove
delivery on a physical phone.

### 4.2 Production M1 shell

The current production custom development client launched from Metro and
rendered the landing shell, runtime status, not-found recovery, and
design-system gallery. Light, dark, increased contrast, and
`accessibility-extra-extra-extra-large` were applied through Simulator
settings. Content reflowed vertically without a horizontal-scrolling
dependency or fixed-height action loss. Settings were restored to light,
non-increased-contrast, medium content size.

### 4.3 Production M2 flows

`OFF-01` through `OFF-06` were exercised sequentially through the production
app. `OFF-02` through `OFF-06` used fresh disposable Aiven validation servers.
For `OFF-05`, the development-only server returned controlled HTTP `503`
responses while the app was terminated and relaunched. The retained version 1
then rendered from SQLCipher before the server was restored for the revision 2
conflict and immutable-history proof.

The controlled API outage proves the app/API boundary without pretending the
iOS Simulator provides a physical radio-off state. The earlier hard-stopped
server run separately confirmed that the production emergency route could
render its retained SQLCipher copy with no API process.

## 5. Defects and Cross-Platform Corrections

The parity pass found and corrected four validation defects:

- the landing screen did not expose the existing `OFF-03` validation route;
- shared `OFF-02` through `OFF-05` screens and server identities still encoded
  Pixel/Android-only labels;
- enrollment validation requests hard-coded Android instead of using the
  current runtime platform; and
- `OFF-05` depended on a physical radio toggle that iOS Simulator cannot
  faithfully provide.

The shared routes now use platform-neutral device validation identities and
runtime `ios`/`android` enrollment values. `OFF-05` uses a narrowly scoped
development-only API availability endpoint for deterministic restart evidence.
It does not alter production synchronization contracts or claim a physical
network-radio test.

## 6. Validation Results

| Command or check | Result |
| --- | --- |
| Retained harness frozen install, typecheck, Expo Doctor, prebuild, iOS native build/install/launch | Pass |
| `pnpm --filter @littlearc/mobile typecheck` | Pass |
| `pnpm --filter @littlearc/mobile test` | Pass; 20 tests |
| `pnpm --filter @littlearc/api typecheck` | Pass |
| `pnpm --filter @littlearc/api test` | Pass; 19 tests |
| `pnpm check:generated` twice | Pass; no generated-output drift |
| Production mobile Expo Doctor | Pass; 20/20 checks |
| Retained M0 harness Expo Doctor | Pass; 20/20 checks |
| `pnpm test:database:rls` | Pass on Aiven PostgreSQL 17.10 |
| `pnpm test:database:household` | Pass; OFF-02 through OFF-05 database suites |
| `pnpm test:database:sync` | Pass |
| `pnpm test:database:emergency-card` | Pass |
| `pnpm test` | Pass; 176 tests across the root workspace |
| `pnpm build` | Pass; 11/11 tasks, including Android and iOS Hermes exports |
| Production `expo run:ios --device … --no-bundler` | Pass; current source built with 0 errors, installed, and launched on the recorded simulator; one non-fatal Expo build-phase dependency warning |
| `pnpm validate` | Pass; workspace policy, generation, formatting, docs, and 13-package typecheck |
| `./tooling/validate-clean-checkout.sh` | Pass in a disposable 385-file source-only snapshot |
| `pnpm check:docs`, `pnpm check:format`, and `git diff --check` | Pass |

Stopping the disposable foreground API servers after their evidence completed
returned operator-initiated exit code `130`; those terminations are not
application or test failures.

## 7. Remaining Obligations

- Physical iPhone installation, real Face ID/Secure Enclave behavior, real
  camera/OCR, notification delivery, radio-off behavior, and Phone dialer
  handoff.
- VoiceOver navigation on a physical iPhone and the broader assistive-
  technology/user-validation matrix.
- Store signing, TestFlight, upgrade and restore behavior, low-memory and
  smallest-phone/tablet coverage.
- Real provider/data checks and two-device conflict evidence.
- All named Gate 2 criteria that are not explicitly proven here.

No existing roadmap gate is closed or narrowed by this Simulator-only pass.

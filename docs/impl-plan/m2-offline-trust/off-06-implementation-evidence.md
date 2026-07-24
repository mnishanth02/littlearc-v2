# OFF-06 Implementation Evidence

> **Status:** Accepted
> **Last updated:** 23 July 2026
> **Owner:** Engineering
> **Work package:** `OFF-06`
> **Plan:** [OFF-06 Onboarding Activation Shell](./off-06-onboarding-activation-shell-plan.md)

---

## 1. Implemented Outcome

LittleArc now has a synthetic-only onboarding activation shell that composes
the accepted OFF-01 through OFF-05 boundaries. The shared mobile flow explains
the privacy promise, confirms the named session checkpoint, acknowledges the
required notice and child-data consent, creates the owner household and child
atomically, enrolls protected local storage, synchronizes one emergency card,
shows an explicitly non-persisted first-record preview, and verifies completion.

The shell does not add an onboarding database, parallel emergency write, second
sync path, real record, analytics identifier, or plaintext draft. It records
only one strictly allowlisted coarse milestone shape. Analytics delivery
remains disabled by default.

## 2. Implemented Boundary

- A pure typed workflow owns the seven ordered states, bounded progress,
  milestone names, duplicate-transition rejection, and completion rule.
- The Expo Router onboarding stack renders one scroll-safe accessible shell
  with semantic tokens, safe retry copy, native progress semantics, headings,
  live content, and fixed synthetic summaries.
- Required parent, notice, consent, and child values are submitted through the
  existing idempotent OFF-02 atomic command. No partial household or child
  persistence was introduced.
- The device adapter reuses OFF-03 protected key custody and SQLCipher,
  OFF-04 synchronization, and the OFF-05 emergency-card repository. Completion
  requires the authoritative card at revision/version 1 with `synced` status.
- The first-record screen is a fixed preview. It selects no file and creates no
  record, mutation, audit entry, server row, or activation credit.
- `onboarding_milestone_reached` permits only milestone, outcome, and platform
  enums. Unknown values, identifiers, extra properties, free text, and seeded
  sensitive canaries are rejected.
- A development-only route and disposable Aiven PostgreSQL mode exercise the
  shared shell without weakening production authority or accepting real data.

## 3. Review and Defect Closure

Plan review confirmed composition rather than replacement of OFF-01 through
OFF-05, atomic creation rather than progressive durable fragments, a
non-persisted M3 preview, and a single bounded analytics event.

Implementation, physical-device validation, and the iOS Simulator follow-up
found and closed four issues:

1. Expo Doctor reported `expo-dev-client` one SDK 57 patch behind. The mobile
   package, lockfile, native development client, and supply-chain release-age
   exception now use `57.0.9`; Doctor then passed all 20 checks.
2. The first physical attempt supplied a new synthetic adult-verification
   string instead of the exact approved OFF-02 port value. The request failed
   safely without partial state. The adapter now uses the accepted assertion,
   and the full flow passed.
3. Emergency-card retry originally regenerated local security while server
   enrollment and card state could already exist. Stable device, card,
   mutation, and idempotency identifiers plus explicit wipe/re-enrollment and
   existing-card detection now make the device proof safely retryable.
4. The completion accessibility label and synthetic session identity encoded
   physical-Android model names. The shared label now describes synthetic
   activation validation, and the disposable harness uses a platform-neutral
   device-validation identity. The corrected source passed the complete iOS
   Simulator flow and exact database assertions.

## 4. PostgreSQL Integration Evidence

The existing real-PostgreSQL gates were rerun against fresh disposable Aiven
databases:

- `pnpm test:database:household` passed atomic owner/child/consent creation,
  exact replay, rollback, authorization, RLS, and minimized evidence.
- `pnpm test:database:sync` passed authenticated pull/snapshot/push,
  idempotency, reset, conflict, tombstone, cursor, and isolation behavior.
- `pnpm test:database:emergency-card` passed encrypted version creation,
  immutable history, replay, conflict, isolation, least privilege, and
  plaintext-canary rejection.

The OFF-06 device server evidence endpoint independently confirmed exactly
one household, one child, two required consents, one enrolled device, one
emergency card, and one immutable card version. Every disposable database was
synthetic and removed by its harness.

## 5. Validation Results

All repository commands used Node.js 24.18.0 and pnpm 11.14.0.

| Validation | Result |
| --- | --- |
| Focused observability tests | Passed; 17 tests include strict onboarding milestone acceptance and identifier/unknown-value rejection. |
| Focused mobile tests and typecheck | Passed; 20 tests include three ordered-workflow tests, and TypeScript accepted the shell and physical adapter. |
| API tests and typecheck | Passed; 19 tests plus integration TypeScript accepted the bounded device mode. |
| Aiven PostgreSQL household, sync, and emergency-card gates | Passed against fresh disposable databases with the retained OFF-02 through OFF-05 security and privacy coverage. |
| `pnpm check:generated` twice | Passed; OpenAPI, generated types, Better Auth adaptation, and reviewed migration artifacts remained idempotent and drift-free. |
| `pnpm test` | Passed; 176 tooling, unit, and contract tests across the workspace. |
| `pnpm build` | Passed; package/server/staff builds and Android/iOS Hermes exports completed. |
| `pnpm --filter @littlearc/mobile run doctor` | Passed all 20 Expo project checks after aligning `expo-dev-client` to `57.0.9`. |
| `pnpm validate` | Passed; toolchain, workspace boundaries, supply chain, generated output, formatting, documentation, and all package typechecks passed. |
| Physical Android OFF-06 flow | Passed on Pixel 8, Android 17/API 37, through the shared shell, protected enrollment, SQLCipher, Aiven API, shared sync, preview, completion, and restart/offline local read. |
| iOS Simulator OFF-06 follow-up | Passed on an iPhone 17 Pro simulator with iOS 26.5 and a custom development client: full activation, simulated matching Face ID, exact Aiven counts, API-down safe retry, accessibility scaling, process restart, and API-offline SQLCipher read. |
| LittleArc process-log privacy scan | Passed; zero fatal/error-pattern matches and zero fixed synthetic payload-canary matches. |
| `git diff --check` | Passed. |
| `./tooling/validate-clean-checkout.sh` | Passed from a source-only snapshot with frozen install and uncached validation. |

## 6. Physical Android Evidence

### 6.1 Abandoned OnePlus capability attempt

The first connected device was a OnePlus 8T (`KB2001`) on Android 14/API 34
with the 5 October 2024 security patch. The shell reached emergency step 5
after privacy, account, consent, and atomic child creation. Android reported a
strong fingerprint sensor but zero enrolled fingerprints, so ADR-0011 correctly
blocked protected SQLCipher enrollment. PIN fallback was not used because the
accepted decision explicitly forbids a device-credential bypass or plaintext
key fallback. This attempt is capability-failure evidence, not a completed
OFF-06 device run.

### 6.2 Accepted Pixel 8 run

The replacement Pixel 8 reported Android 17/API 37, build
`CP2A.260705.006`, the 5 July 2026 security patch, and enrolled strong
biometrics. The local LittleArc development client targeted SDK 36 and used
`expo-dev-client` 57.0.9.

The shared shell completed this fixed synthetic sequence:

1. rendered the privacy promise and accurate step 1-of-7 progress semantics;
2. confirmed the named OFF-01 synthetic session without provider or identity
   data;
3. acknowledged `parent-notice-v1` and `child-data-processing-v1`, with
   optional AI/vision processing still separate and off;
4. created one synthetic owner household and child through the atomic OFF-02
   command;
5. displayed the platform biometric cryptographic prompt, enrolled SQLCipher
   schema V3, synchronized the child projection, queued the emergency card in
   the accepted local repository, and pulled authoritative version 1;
6. rendered the explicitly synthetic first-record preview without selecting a
   file or creating a record; and
7. verified the exact bounded server evidence and exposed the then-current
   native semantic summary `OFF-06 physical Android validation passed`.

The later iOS Simulator follow-up replaced that platform-specific label with
`OFF-06 synthetic activation validation passed` in the shared source.

The app was then force-stopped. Wi-Fi was disabled, LittleArc's API reverse
binding was removed, and mobile data remained in its original off state.
After restart, the production emergency route reopened the retained SQLCipher
card and displayed `Available offline` with the expected structural
`notProvided` and `noneConfirmed` values. Wi-Fi and the LittleArc API binding
were restored immediately; the original mobile-data state was preserved.

At 200% font scale with Android high contrast enabled, the shell remained
scrollable, headings and body copy wrapped without overlap, progress retained
its native value, and the primary action remained fully reachable. Both device
settings were restored to their original values. UIAutomator inspected the
ordered LittleArc-only accessibility tree, including headings, warning,
progress, step content, buttons, offline notice, and completion summary.
TalkBack was installed but was not enabled globally on this personal banking
device because changing its device-wide accessibility-service configuration
could affect unrelated secure applications; full TalkBack navigation remains
part of the wider Gate 2 matrix.

No non-LittleArc application was opened or controlled. One Android
configuration restart returned to the launcher before LittleArc was reopened;
the launcher UI hierarchy exposed only visible launcher labels during that
transition, and no application content, notification, account, file, or
clipboard was accessed.

## 7. iOS Simulator Follow-up

The final shared source was built and installed as a custom Expo development
client on the Xcode 26.5 (`17F42`) iPhone 17 Pro simulator (`iPhone18,1`) with
iOS 26.5. The native build completed with zero errors. The two retained build
warnings were the Expo Dev Launcher local-network-key dependency-selection
warning and the simulator-only ML Kit framework platform-load warning; neither
blocked installation or runtime.

The corrected shell completed all seven steps against a fresh disposable Aiven
database. Simulator Face ID was marked enrolled before the protected-storage
step, and a simulated matching face satisfied the native prompt. The evidence
endpoint returned exactly:

- one household;
- one child;
- two required consent grants;
- one enrolled device;
- one active emergency card; and
- one immutable emergency-card version.

With the API stopped, the account checkpoint stayed on step 2, rendered
`Onboarding paused safely`, and exposed a reachable retry action without
advancing. With `UICTContentSizeCategoryAccessibilityMedium` and increased
contrast enabled, the shell remained scrollable and its primary actions
remained reachable through the simulator accessibility tree. The emergency
card was also inspected at the maximum accessibility content-size category and
remained vertically scrollable with wrapping content. Settings were restored
to the standard `large`, light, non-increased-contrast state.

After final-source completion, the API harness was stopped and LittleArc was
terminated and launched again. The production emergency-card route reopened
the retained SQLCipher copy without the API and displayed the expected
`notProvided`, `noneConfirmed`, and synthetic guardian values.

This is development-client simulator evidence. Simulator enrollment and a
simulated matching face do not prove physical Face ID, Secure Enclave behavior,
device signing/distribution, or VoiceOver navigation on an iPhone.

## 8. Evidence Boundaries

The run used fixed synthetic content, a named synthetic session, a disposable
database, one physical Android device, and one iOS Simulator. It does not
claim:

- real parent, child, participant, contact, medical, record, or file data;
- live email/social identity, provider verification, production credentials,
  signed store distribution, or analytics delivery;
- physical iOS, a second physical device, low-end Android, or the complete
  assistive-technology matrix;
- a real first record, reminder, seven-day activation event, locked quick
  access, share/export, or optional AI/vision consent; or
- Gate 2 closure. Both-platform onboarding is now evidenced only within the
  bounded physical-Android plus iOS-Simulator development-client matrix.
  Two-device conflict, full TalkBack/VoiceOver and low-end coverage,
  sign-out/invalidation scenarios, and every other named criterion remain
  open.

## 9. Completion Decision

**Decision: COMPLETE.** OFF-06 meets its bounded synthetic activation-shell
boundary through ordered accessible mobile orchestration, atomic owner/child
creation, protected local enrollment, shared authoritative emergency-card
synchronization, a non-persisted first-record preview, strict coarse analytics,
Aiven integration, comprehensive repository validation, the accepted Pixel 8
lifecycle, and the bounded iOS Simulator follow-up. M2 and Gate 2 remain open
for the explicitly unproven matrix and criteria.

## Cross-Milestone Reconfirmation — 23 July 2026

A fresh disposable-database run reconfirmed the final seven-step production
shell on the iPhone 17 Pro Simulator. The exact endpoint again reported one
household, one child, two required consents, one enrolled device, one active
emergency card, and one immutable version. The earlier same-source failure/
retry, simulated Face ID, accessibility, restart, and API-offline SQLCipher
checks remain the owning detailed evidence above. See the
[cross-milestone parity dossier](../ios-simulator-parity-validation-evidence.md).

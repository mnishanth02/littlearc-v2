# Gate 2 Offline Trust Closure Plan

> **Status:** In progress — execution authorized; physical-device matrix blocked
> **Started date:** 26 July 2026
> **Last updated:** 26 July 2026
> **Completion date:** N/A
> **Owner:** Engineering
> **Milestone:** M2
> **Gate:** Gate 2 — Offline Trust Is Proven
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
> **Roadmap source:** [Implementation Plan and Roadmap](../roadmap.md#112-gate-2--offline-trust-is-proven)

---

## 1. Authorization Boundary

The founder accepted this exact plan and separately authorized bounded
implementation plus synthetic local and disposable-Aiven validation on 26 July
2026, including approved physical-device biometric changes. That authorization
does not authorize Railway, production, real data, Gate 2 closure, or work
outside this plan.

The future execution must:

- use fixed synthetic identities, household, child, contact, and emergency-card
  fixtures only;
- use disposable local Aiven PostgreSQL databases only;
- keep Railway staging and production untouched;
- keep production services, credentials, providers, buckets, and data
  untouched;
- avoid real child, household, participant, contact, identity, or medical data;
- avoid live email, Apple, Google, or other identity-provider delivery;
- preserve the development-only validation-route release containment;
- stop on privacy leakage, destructive device impact, failed cleanup, or
  unexplained security behavior; and
- leave Gate 2 open until every criterion has current accepted evidence and the
  dashboard is explicitly updated.

## 2. Outcome

Produce one reviewable Gate 2 evidence dossier that:

1. maps all nine roadmap criteria to current executable evidence;
2. reconfirms already-supported criteria against the final source state;
3. closes the physical-iOS, biometric-invalidation, real two-device conflict,
   full screen-reader, and low-end Android gaps;
4. records device, database, security, privacy, cleanup, and repository proof
   without overstating simulator or synthetic evidence; and
5. supports an explicit founder decision to close Gate 2 or retain named
   blockers.

This plan does not automatically authorize `VLT-06` or later M3 work. Gate 2
closure and later-package authorization remain separate recorded decisions.

## 3. Scope

### In Scope

- The nine Gate 2 criteria in roadmap section 11.2.
- Current-source automated and disposable-Aiven reconfirmation.
- Fresh-install onboarding and emergency-card validation on physical Android
  and physical iOS.
- Airplane-mode process-restart access to the encrypted emergency card.
- Sign-out wipe and post-wipe inaccessibility.
- Actual OS biometric-enrollment change and recovery on dedicated physical
  devices.
- A real two-physical-device stale critical-field conflict.
- Exact retry, cursor-expiry/reset, tenant isolation, authorization,
  revocation, and analytics-canary proof.
- Dynamic type/text scaling, high/increased contrast, TalkBack, VoiceOver, and
  target low-end Android behavior for the emergency flow.
- Privacy-safe screenshots, structured observations, database counts, bounded
  device logs, cleanup proof, and an implementation evidence dossier.
- Narrow defect fixes discovered by the accepted execution, but only after
  this plan receives explicit implementation authorization.

### Non-Goals

- Real data, participant research, pediatric approval, privacy/legal approval,
  security-specialist approval, or invited-pilot readiness.
- Live OTP/email/social-provider delivery or production identity.
- Railway staging or production deployment.
- TestFlight, App Store, Play Store, production signing, or store upgrades.
- Full pre-pilot scanner, OCR, notification, share-extension, tablet,
  orientation, rooted/jailbroken-device, or broad device-capability coverage.
- Locked-screen emergency access or resolution of `OD-03`.
- VLT-05-F4, VLT-06, OCR, previews, document upload, or other M3 functionality.
- Accessibility claims based on representative-user research. Such research
  remains a separate pre-pilot obligation.
- New performance promises or numerical service-level objectives not already
  approved by product and engineering.

## 4. Source-Of-Truth And Evidence Rules

The audit uses this precedence:

1. current executable behavior, tests, and configuration;
2. accepted ADRs, especially ADR-0011, ADR-0012, and ADR-0013;
3. `docs/IMPLEMENTATION_STATUS.md`;
4. accepted OFF-01 through OFF-06 plans and evidence;
5. the iOS Simulator parity dossier; and
6. roadmap and core/reference documentation.

Evidence classifications:

- **Satisfied:** accepted evidence directly proves the criterion within the
  Gate 2 synthetic boundary. It must still be reconfirmed on the final source
  state before closure.
- **Partial:** material behavior is proven, but a named platform, device, or
  real-world boundary is missing.
- **Outstanding:** the criterion's defining acceptance behavior has not been
  directly demonstrated.
- **Blocked:** execution cannot complete without an external device, approval,
  account, or environment.

Automated tests do not substitute for physical-device requirements. An iOS
Simulator is not physical iOS or Secure Enclave evidence. A server-simulated
writer is not a second device. Semantic-tree inspection is not a complete
TalkBack or VoiceOver walkthrough.

## 5. Confirmed Current-State Audit

| # | Gate 2 criterion | Current classification | Confirmed evidence | Missing proof required for closure |
| --- | --- | --- | --- | --- |
| G2-01 | A new parent can enroll, consent, create a child, and complete the emergency card on both platforms. | **Partial** | OFF-06 passed the complete seven-step synthetic activation on current source using a physical Pixel 8 and disposable Aiven state. The iPhone 17 Pro Simulator remains regression evidence only. | Repeat the complete flow on a physical Face ID iPhone. |
| G2-02 | The emergency card opens with airplane mode enabled after process restart. | **Passed on physical Android; iOS blocked** | Current-source true radio-off, API-down, force-stop, relaunch, biometric unlock, and SQLCipher read passed on the physical Pixel 8. iOS Simulator passed API-offline termination/relaunch but not physical radio-off. | Include physical-iPhone airplane-mode restart in the final matrix to remove platform ambiguity. |
| G2-03 | Sign-out makes sensitive local data inaccessible. | **Passed on physical Android; iOS blocked** | Current-source OFF-03 sign-out removed SQLCipher, encrypted files, key index, marker, and protected keys on the Pixel; post-wipe emergency-card access failed as not enrolled, and final app-data clear left no app data. | Prove physical-iPhone Keychain/SQLCipher inaccessibility. |
| G2-04 | Biometric invalidation recovers through reauthentication/resync. | **Passed on physical Android; iOS blocked** | A real remove-one/add-one fingerprint-set replacement permanently invalidated the Pixel key. LittleArc failed closed, then passed synthetic wipe/re-enrollment, authoritative resync, API-down airplane-mode reopen, and terminal wipe. | Repeat actual biometric-set mutation, recovery, offline reopen, and wipe on a physical Face ID iPhone. |
| G2-05 | Two devices synchronize edits and display a stale critical-field conflict. | **Outstanding** | OFF-04/OFF-05 passed conditional revisions and explicit conflict UI with a server-simulated second writer. | Use two simultaneously enrolled physical devices in one disposable synthetic household and generate the conflict through both real clients. |
| G2-06 | Duplicate mutation retries do not create duplicate records or audit events. | **Satisfied, reconfirm** | Unit, API, database, disposable-Aiven, and bounded device evidence passed exact replay and stable record/version/audit/change/outbox counts. | Rerun final-source automation and include an interrupted/retried mutation in the two-device run with before/after database counts. |
| G2-07 | Cursor expiry rebuilds the local read model safely. | **Satisfied, reconfirm** | OFF-04 database, repository, physical-Pixel, and iOS-Simulator evidence passed typed expiry, reset snapshot, retained SQLCipher resume, tombstone safety, and restart. | Reconfirm current source on both physical conflict devices and show that local pending/conflict state is neither lost nor silently applied. |
| G2-08 | Household RLS, BOLA, session revocation, and analytics-canary tests pass. | **Satisfied, reconfirm** | Accepted auth, household, RLS, sync, emergency-card, observability, and disposable-Aiven suites passed these controls without seeded plaintext leakage. | Rerun every owning suite on a fresh disposable database and record exact commands, source revision, counts, cleanup, and canary results. |
| G2-09 | Dynamic type up to 200%, screen readers, high contrast, and target low-end Android behavior pass for the emergency flow. | **Passed on primary Android; iOS/low-end blocked** | On current source, the physical Pixel passed 200% text, Android high contrast, scrolling, reachability, and a TalkBack-driven encrypted-card and synthetic-dialer action. Simulator passed maximum accessibility size and increased contrast. | Complete VoiceOver, maximum text, and contrast on a physical iPhone; approve and test a physical target low-end Android profile. |

Current verdict: **five criteria are satisfied subject to final-source
reconfirmation; four criteria remain partial or outstanding. Gate 2 remains
open.**

## 6. Required Device And Environment Matrix

| Target | Minimum role | Required capability | Current availability |
| --- | --- | --- | --- |
| Physical Google Pixel 8 | Primary Android and first conflict device | Android 17/API 37, strong biometrics, TalkBack, radio controls, ADB, development client | Attached during planning as serial `3A110DLJH000U7`; availability must be rechecked at execution |
| Physical iPhone with Face ID | Physical iOS and second conflict device | Supported iOS version, Face ID enrollment, VoiceOver, airplane mode, trusted development-client signing, physical Keychain/Secure Enclave path | **Blocked:** no physical iPhone appeared in the planning-time Xcode device inventory |
| Physical target low-end Android | Low-end emergency-flow acceptance | Product-approved minimum/representative OS, RAM, CPU, screen size, TalkBack, biometrics if used, and install/debug access | **Blocked:** exact target profile and device are not recorded |
| iPhone 17 Pro Simulator | Regression aid only | Build/install smoke, failure injection, and comparison with prior evidence | Available; cannot satisfy physical iOS, VoiceOver, Secure Enclave, or two-device proof |
| Disposable local Aiven PostgreSQL | Synthetic server authority | Fresh temporary database, reviewed migrations, application/RLS roles, deterministic teardown | Required; availability and `.env.aiven` validity must be checked at execution |
| Local Mac development host | Builds and evidence control | Node 26.4.0, pnpm 11.14.0, Xcode/Android toolchains, ADB, isolated Metro/API listeners | Required |

The Pixel 8 and physical iPhone should be the two-device pair unless execution
review identifies an incompatibility. The low-end Android device is a third
target because a flagship Pixel cannot establish target low-end behavior.

Do not change biometric enrollment or enable a screen reader on a personal
device that contains unrelated sensitive applications. Use dedicated test
devices or obtain explicit device-owner approval, record the starting state,
and restore settings after validation.

## 7. Open Questions Requiring Review

1. Which physical iPhone model and supported iOS version will be supplied, and
   is its development signing/profile ready?
2. What exact physical Android device represents the supported low-end target?
   Record model, SoC, RAM, OS/API, screen dimensions, and storage state before
   execution.
3. Is there an approved numerical performance threshold for the emergency
   flow? If not, Gate 2 will use the roadmap's behavioral standard: no crash,
   ANR, blocked interaction, clipped critical content, failed offline reopen,
   or failed synchronization, while recording observed timings without
   creating a new SLA.
4. Are dedicated test-device biometric changes authorized on both platforms?
5. May the existing development-only validation routes remain installed on
   those devices for the duration of the evidence run? They remain excluded
   from release exports.

Questions 1, 2, and 4 block complete execution. They do not block plan review.

## 8. Validation Data And Privacy Design

- Use a newly generated synthetic session and opaque UUIDs for every run.
- Use conspicuously synthetic names, dates, contacts, notes, and identifiers
  from the existing test harness; never import a real address book entry,
  photo, document, email, or account.
- Create one disposable Aiven database for each destructive device matrix or
  one fresh database with isolated synthetic run IDs when simultaneous devices
  require shared authority.
- Seed privacy canaries that are safe synthetic strings and assert that they do
  not appear in plaintext PostgreSQL operational tables, logs, analytics,
  crash output, or committed evidence.
- Keep screenshots limited to LittleArc screens with fixed synthetic data.
  Disable notification previews and close unrelated applications before
  capture. Do not commit raw device dumps, full logs, tokens, cookies, signed
  URLs, local paths, emails, device-owner data, or database credentials.
- Evidence may record device model, OS/API, app/build revision, synthetic run
  label, pass/fail state, counts, durations, and sanitized error codes.
- Delete disposable databases, synthetic server state, local databases,
  sidecars, encrypted files, SecureStore/Keychain entries, app data, ADB
  reverse rules, Metro/API listeners, and temporary build artifacts at the
  documented cleanup point.

## 9. Validation Procedures

### 9.1 Preflight And Source Freeze

1. Record branch, commit, `git status --short`, staged/unstaged diff summaries,
   Node/pnpm versions, lockfile digest, device inventory, and toolchain
   versions.
2. Refuse to overwrite or discard unrelated worktree changes.
3. Confirm production has not been selected in any CLI or environment.
4. Confirm fixed synthetic fixtures and the release-bundle containment checks.
5. Run focused unit/contract tests before native or database work.
6. Build fresh development clients from the same recorded source for every
   physical device.
7. Take a settings baseline for biometrics, font scale/Dynamic Type, contrast,
   TalkBack/VoiceOver, network state, and installed LittleArc app state.

### 9.2 G2-01 Onboarding On Both Physical Platforms

For a clean application state on the Pixel and physical iPhone:

1. establish a development-only synthetic session without live delivery;
2. complete all seven OFF-06 steps;
3. accept only the required synthetic consent versions;
4. create exactly one synthetic owner household and child;
5. create protected SQLCipher/Keychain or Keystore state;
6. synchronize exactly one emergency card and immutable version;
7. render the production emergency card; and
8. assert exact server counts, local schema version, absence of optional
   AI/vision consent, no fatal logs, and no privacy canary.

Pass only if both physical platforms complete the same semantic outcome.

### 9.3 G2-02 Offline Restart

On each primary physical platform:

1. complete synchronization while online;
2. enable airplane mode and independently verify API unreachability;
3. force-stop/terminate LittleArc;
4. relaunch without Metro/API dependency where the installed development
   client permits;
5. open the production emergency card from SQLCipher;
6. verify the expected version, freshness/offline label, and critical fields;
7. scan current-process logs for fatal errors and synthetic content; and
8. restore the original radio state.

An API process outage alone is not equivalent to physical airplane mode.

### 9.4 G2-03 Sign-Out Inaccessibility

On Pixel and physical iPhone:

1. begin with synchronized encrypted local state;
2. include pending/conflicted work in at least one run and exercise the explicit
   discard warning;
3. sign out while recording whether remote sign-out succeeds or is forced to
   fail;
4. verify cleanup remains unconditional;
5. inspect database, WAL/SHM, encrypted-file directory, key index,
   enrollment marker, SecureStore/Keychain/Keystore state, and app-visible
   routes; and
6. prove the emergency card cannot reopen until synthetic reauthentication and
   resynchronization.

### 9.5 G2-04 Actual Biometric Invalidation

Run only on dedicated or explicitly approved devices:

1. enroll and synchronize, then prove protected key access;
2. terminate LittleArc;
3. add a new fingerprint on Android and change the enrolled Face ID profile on
   iPhone using the platform's normal settings;
4. relaunch and attempt protected-key access;
5. require an invalidation/reauthentication state rather than plaintext
   fallback, silent key recreation, or crash;
6. use the development-only synthetic authentication boundary to reauthenticate;
7. remove unrecoverable local ciphertext and sidecars;
8. create a fresh protected generation, replay enrollment exactly once, and
   resynchronize the emergency card;
9. repeat the airplane-mode restart against the new generation; and
10. verify old protected material remains inaccessible and all settings are
    restored or the device is securely reset.

Expo documents that `requireAuthentication` entries become inaccessible after
biometric settings change. Android's Keystore similarly invalidates
biometric-only keys by default after new enrollment. Unexpected continued
access is a stop condition requiring root-cause review, not an automatic pass.

### 9.6 G2-05 Real Two-Device Conflict

Use the Pixel and physical iPhone against the same disposable synthetic
household:

1. enroll both installations independently and synchronize revision 1;
2. take device A offline and edit one critical emergency-card field from
   revision 1;
3. keep device B online, edit the same critical field differently, push
   revision 2, and pull it successfully;
4. reconnect device A and push its stale revision-1 proposal;
5. verify the server returns a conflict without creating revision 3;
6. verify device A preserves both authoritative revision 2 and its local
   proposal in the explicit review state;
7. verify device B retains authoritative revision 2 with no phantom local
   proposal;
8. restart both devices and verify the same durable state;
9. record exact version, audit, change, outbox, mutation, idempotency, and
   conflict counts; and
10. deliberately resolve/discard the stale proposal only after evidence is
    captured.

The run fails if the stale write wins, either side disappears, a duplicate
version/audit event appears, or one physical client is replaced by a
server-simulated writer.

### 9.7 G2-06 Duplicate Retry

1. Interrupt the response boundary after the server commits one synthetic
   mutation.
2. Retry the identical mutation and idempotency key from the originating
   physical client.
3. Verify the client converges, the server returns duplicate/exact replay
   semantics, and record/version/audit/change/outbox counts remain unchanged.
4. Retry changed content with the same key and verify fail-closed mismatch
   behavior.
5. Retain the owning unit and Aiven integration suites as deterministic proof.

### 9.8 G2-07 Cursor Expiry And Safe Rebuild

1. Synchronize both devices and retain a controlled pending or conflict state.
2. Advance the disposable test authority's retained sequence floor so the
   client's signed cursor expires.
3. Pull and observe typed `cursor_expired`.
4. Build a staged snapshot at a captured sequence, atomically replace the
   authoritative local projection, and resume incremental pull.
5. Verify tombstones remain deleted, encrypted state remains readable, pending
   mutations/conflicts retain their intended state, and no stale row is
   resurrected.
6. Terminate/relaunch and repeat the final assertions on both devices.

### 9.9 G2-08 Server Security And Privacy Controls

Against fresh disposable Aiven databases:

1. run authentication/session lifecycle, household/BOLA, synchronization,
   emergency-card, and seeded RLS suites;
2. prove cross-household reads/writes fail under `littlearc_app`;
3. prove selected and all-other session revocation invalidate authentication;
4. verify analytics allowlists reject raw identifiers, values, and free-form
   fields;
5. scan PostgreSQL operational evidence and bounded logs for the fixed
   synthetic canaries; and
6. drop every temporary database and independently verify cleanup.

### 9.10 G2-09 Accessibility And Low-End Android

Run the complete emergency flow, including onboarding, offline reopen, conflict
review, retry/error state, and sign-out:

- **Android text/contrast:** 200% font scale and high text contrast; verify
  reflow, scrolling, focus visibility, no overlap/clipping, and reachable
  actions on Pixel and the approved low-end device.
- **TalkBack:** enable TalkBack globally on a dedicated physical Android,
  navigate linearly and by touch, complete every critical action without
  sighted tap substitution, verify logical order, concise labels, roles,
  states, alerts, errors, and focus retention.
- **iOS text/contrast:** maximum relevant accessibility Dynamic Type category
  and Increase Contrast on physical iPhone; verify reflow and reachability.
- **VoiceOver:** enable VoiceOver on the physical iPhone and complete the same
  tasks using VoiceOver gestures. Use Screen Curtain for at least one complete
  emergency-card read/recovery path so the run does not rely on visual
  navigation.
- **Low-end behavior:** on the approved physical low-end Android, run fresh
  launch, onboarding, synchronization, airplane-mode restart, emergency-card
  read, conflict state, TalkBack, 200% text, sign-out, and recovery. Record
  observed launch/read/sync timings, memory warnings, dropped interactions,
  and ANR/crash state.

Android recommends combining manual screen-reader interaction with automated
analysis because automated tools cannot detect all device-runtime issues.
Apple requires physical-device VoiceOver testing and task completion using the
assistive technology.

## 10. Evidence Artifacts

Create only after execution is authorized:

- `docs/impl-plan/m2-offline-trust/gate-2-offline-trust-closure-evidence.md`
  containing the final nine-row verdict, source revision, environment,
  commands, exact sanitized results, device matrix, defects/fixes, cleanup, and
  founder decision.
- A sanitized device-run table for each physical device: model, OS/API,
  build identifier, test roles, settings, pass/fail, and restoration state.
- A two-device sequence table with revisions and counts, not raw payloads.
- A database evidence table with disposable database label, migrations,
  assertions, and confirmed teardown.
- Accessibility checklists for TalkBack, VoiceOver, text scale, contrast, and
  low-end behavior, including failed or deferred rows.
- Sanitized screenshots only where they materially prove layout/state.
- Bounded log-scan summaries and canary counts; do not commit raw logs.
- Final `git diff --check`, documentation, repository, mobile build, and
  clean-checkout results.

Update only after all acceptance criteria pass:

- `docs/IMPLEMENTATION_STATUS.md` to mark M2/Gate 2 complete and identify the
  newly ready package;
- `docs/impl-plan/roadmap.md` with a dated evidence note, without changing the
  gate definition;
- this plan's status header and module table;
- `docs/impl-plan/m2-offline-trust/README.md`, `docs/index.md`, and
  `docs/context-map.yaml` with the accepted evidence link.

If any criterion remains blocked or fails, keep M2 `IN PROGRESS`, keep Gate 2
open, and record the exact blocker and retest trigger.

## 11. Affected Files And Modules

### Planning-Only Changes In This Run

- `docs/impl-plan/m2-offline-trust/gate-2-offline-trust-closure-plan.md`
- `docs/impl-plan/m2-offline-trust/README.md`
- `docs/index.md`
- `docs/context-map.yaml`

### Potential Execution-Time Files

No production source change is required if current behavior passes. If the
accepted execution reveals a defect, changes must stay within:

- `apps/mobile/src/onboarding/**`
- `apps/mobile/src/local-security/**`
- `apps/mobile/src/sync/**`
- `apps/mobile/src/emergency-card/**`
- `apps/mobile/app/(app)/off-*-validation.tsx`
- `apps/mobile/src/onboarding/route-content.validation.tsx`
- `apps/api/src/owner-onboarding*`
- `apps/api/src/sync*`
- `apps/api/src/emergency-card*`
- `packages/auth/**`
- `packages/database/src/{device-enrollment,owner-onboarding,sync}.ts`
- `packages/crypto/**`
- `packages/observability/**`
- focused tests beside those modules; and
- existing device/release validation tooling.

Any schema, migration, public contract, provider, new dependency, or production
configuration change is outside this plan and requires a revised plan plus
separate approval.

## 12. Validation Commands

Run the smallest focused checks first, then the full repository gates:

```sh
git status --short
git diff --stat
git diff --cached --stat
node --version
pnpm --version

pnpm --filter @littlearc/mobile test
pnpm --filter @littlearc/auth test
pnpm --filter @littlearc/api test
pnpm --filter @littlearc/database test
pnpm --filter @littlearc/observability test
pnpm test:contract

pnpm test:database:auth
pnpm test:database:household
pnpm test:database:sync
pnpm test:database:emergency-card
pnpm test:database:rls

pnpm --filter @littlearc/mobile run doctor
pnpm --filter @littlearc/mobile build:android
pnpm --filter @littlearc/mobile build:ios
pnpm typecheck
pnpm validate
./tooling/validate-clean-checkout.sh

pnpm check:docs
git diff --check
git diff --cached --check
```

Native builds, installs, device launches, ADB/Xcode inventory, physical
settings, logs, and cleanup commands must be recorded exactly in the evidence
dossier because their commands depend on the accepted device models and
signing state.

## 13. Module Status

| Module | Status | Verification point |
| --- | --- | --- |
| Gate criteria and evidence audit | Completed for planning | Nine-row current-state matrix reviewed against roadmap and accepted dossiers |
| Founder plan review | Completed | Exact plan and bounded execution authorization recorded on 26 July 2026 |
| Physical Android reconfirmation | Completed | Pixel onboarding, biometric unlock, radio-off cold restart, 200% text, contrast, TalkBack, actual fingerprint invalidation, synthetic recovery/resync, second offline reopen, sign-out wipe, and terminal cleanup passed |
| Physical iOS proof | Blocked | Physical Face ID iPhone, signing, and biometric-change authorization supplied |
| Two-device conflict | Blocked | Pixel and physical iPhone available simultaneously |
| Low-end Android proof | Blocked | Product-approved target profile and physical device supplied |
| Automated and Aiven reconfirmation | Completed | Focused, broad, security, privacy, migration, and disposable-database cleanup checks passed |
| Evidence and closure decision | In Progress | [Partial evidence](./gate-2-offline-trust-closure-evidence.md) records passed checks and named blockers; Gate 2 remains open |

## 14. Ordered Execution Steps

Each step has an independent stop/verification point:

1. **Accept the plan and resolve device questions.** Record the physical iPhone,
   low-end Android target, biometric-change permission, and behavioral
   performance standard.
2. **Freeze and validate the source state.** Capture diffs/toolchains and pass
   focused unit/contract tests. Stop on unrelated or unexplained failures.
3. **Reconfirm server controls.** Run fresh disposable-Aiven auth, household,
   sync, emergency-card, and RLS suites; verify teardown.
4. **Build one exact development-client revision.** Pass Android/iOS builds,
   release canary containment, install, launch, and bounded privacy log scans.
5. **Run Pixel baseline.** Reconfirm G2-01, G2-02, G2-03, G2-06, and G2-07.
6. **Run physical-iPhone baseline.** Close the physical half of G2-01 and
   reconfirm G2-02/G2-03 on iOS.
7. **Run actual biometric invalidation.** Complete Android and iOS mutation,
   recovery, resync, and post-recovery offline proof.
8. **Run the two-device scenario.** Close G2-05 and simultaneously reconfirm
   duplicate retry and cursor-reset safety.
9. **Run accessibility and low-end matrices.** Complete TalkBack, VoiceOver,
   200%/maximum text, contrast, and approved low-end behavior.
10. **Run broad repository validation.** Pass generated checks, builds,
    `pnpm validate`, docs, diff checks, and clean checkout.
11. **Clean every temporary resource.** Restore device settings, clear local
    synthetic state, remove listeners/tunnels/artifacts, drop databases, and
    verify no production or Railway changes.
12. **Write evidence and request closure.** Do not change Gate 2 status until
    the nine-row dossier has no failed, partial, blocked, or deferred criterion
    and founder acceptance is recorded.

If a code defect is found, pause the matrix, document the failing criterion,
make only the authorized narrow fix, rerun its focused checks, and restart every
device scenario whose evidence could have been invalidated by the change.

## 15. Risks, Rollback, And Stop Conditions

| Risk | Control | Stop or rollback |
| --- | --- | --- |
| Personal-device data or settings are affected | Dedicated devices, baseline settings, synthetic app state, no unrelated app interaction | Stop immediately; restore settings or securely reset the dedicated device and record the incomplete row |
| Biometric change does not invalidate protected material | Require actual OS mutation and inspect the security state without adding fallback | Stop; retain Gate 2 open and diagnose against platform/SecureStore behavior |
| Server-simulated conflict is mistaken for two-device proof | Require two physical client installations and record both local states | Reject the evidence and rerun with both devices |
| Simulator evidence is generalized to physical iOS | Label each artifact by target and capability | Keep physical-iOS rows blocked |
| Low-end target is chosen after results are known | Approve model/specification before execution | Do not run or claim G2-09 until approved |
| Accessibility tree passes but workflow is unusable | Complete critical tasks using TalkBack/VoiceOver, not inspection alone | Record failure and fix before rerun |
| Synthetic values leak to logs or operational state | Fixed canaries, bounded scans, sanitized evidence | Stop, remove artifacts, fix leakage, and rerun affected validation |
| Disposable Aiven state remains | Unique database labels and independent post-drop check | Do not accept database evidence until teardown is confirmed |
| Validation source changes mid-matrix | Record commit/diff/build identity and rebuild after relevant changes | Invalidate affected device evidence and restart from the source-freeze step |
| Existing dirty worktree is overwritten | Inspect staged/unstaged diffs and make narrow patches only | Stop before any destructive Git operation |

Rollback is evidence-oriented: restore device settings, remove the development
app and synthetic local state, drop disposable databases, stop local services,
and leave the gate status unchanged. There is no production or Railway rollback
because those environments are outside scope.

## 16. Acceptance Criteria

Gate 2 is eligible for closure only when:

- all nine roadmap criteria are marked **Passed** in the final evidence dossier;
- the physical Pixel, physical Face ID iPhone, and approved physical low-end
  Android matrix is complete;
- actual biometric-set mutation and recovery passes without plaintext fallback;
- two real physical clients produce and durably display the expected stale
  critical-field conflict;
- duplicate retry and cursor-expiry/reset preserve exact server and local state;
- fresh disposable-Aiven RLS, BOLA, session-revocation, and analytics-canary
  checks pass;
- TalkBack and VoiceOver can complete the critical emergency workflows, and
  200%/maximum text plus contrast remain usable;
- low-end Android completes the named behavioral matrix without crash, ANR,
  blocked action, inaccessible critical content, failed sync, or failed offline
  reopen;
- release exports still exclude development validation fixtures and routes;
- no real data, production, Railway, or live-provider boundary was crossed;
- every database, local app artifact, listener, tunnel, and device setting is
  cleaned up or explicitly retained with owner and reason;
- focused tests, native builds, broad validation, documentation checks, diff
  checks, and clean-checkout validation pass on the final source; and
- the founder reviews the completed evidence and explicitly accepts Gate 2
  closure.

Any failed, partial, blocked, deferred, or unverified row keeps Gate 2 open and
does not automatically authorize `VLT-06`.

## 17. Stable Platform References

- [Android: Test your app's accessibility](https://developer.android.com/guide/topics/ui/accessibility/testing)
- [Android: Biometric authentication and key invalidation](https://developer.android.com/identity/sign-in/biometric-auth)
- [Android Keystore: `setInvalidatedByBiometricEnrollment`](https://developer.android.com/reference/kotlin/android/security/keystore/KeyProtection.Builder#setInvalidatedByBiometricEnrollment(kotlin.Boolean))
- [Apple: Performing accessibility testing for your app](https://developer.apple.com/documentation/accessibility/performing-accessibility-testing-for-your-app)
- [Apple: VoiceOver](https://developer.apple.com/documentation/accessibility/voiceover/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)

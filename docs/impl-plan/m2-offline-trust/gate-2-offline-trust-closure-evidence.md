# Gate 2 Offline Trust Closure Evidence

> **Status:** Partial — Gate 2 remains open
> **Execution date:** 26 July 2026
> **Last updated:** 26 July 2026
> **Owner:** Engineering
> **Milestone:** M2
> **Gate:** Gate 2 — Offline Trust Is Proven
> **Accepted plan:** [Gate 2 Offline Trust Closure Plan](./gate-2-offline-trust-closure-plan.md)
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)

---

## 1. Verdict

The accepted automated, repository, release-containment, native-build, and
disposable-Aiven checks passed on the recorded source state. A resumed
physical-Pixel run also passed current-source synthetic onboarding, protected
enrollment, radio-off cold restart, encrypted offline emergency-card access,
200% text, high contrast, a TalkBack-driven emergency action, actual
fingerprint-set invalidation, recovery, offline reopen, and terminal wipe.

Gate 2 is not eligible for closure because no physical Face ID iPhone or
approved physical low-end Android was available, a second physical client was
not available, and the remaining iOS and two-device criteria therefore cannot
be proven. Railway and production were untouched, and only fixed synthetic
fixtures were used.

## 2. Authorization And Source Boundary

- Founder authorization: accepted plan plus bounded implementation and
  synthetic local/disposable-Aiven validation, including approved
  physical-device biometric changes.
- Explicit exclusions: Railway, production, real data, live identity-provider
  delivery, and any work outside the accepted plan.
- Branch: `development`
- Base revision: `671fae7c4872a0783d85a00f778480d9b69d95e8`
- Node: `v26.4.0`
- pnpm: `11.14.0`
- Lockfile SHA-256:
  `39e0b998c2d7eda8873d54b9a9bec7a2147e08aa128e55c724157f1abe2a91b1`
- Worktree: pre-existing staged, unstaged, and untracked VLT-05/F3 work was
  preserved. This Gate 2 run did not discard or rewrite unrelated changes.

## 3. Narrow Implementation

The local validation API originally bound every OFF-02 through OFF-06 device
harness to port `3000`. An unrelated local process already owned that port.
The integration-only harness now consistently uses
`LITTLEARC_DEVICE_API_PORT`, through its existing `deviceApiPort` value, for
configuration, listener binding, and status output.

Affected file:

- `apps/api/integration/off-02-household.ts`

This does not alter a production API route, public contract, migration,
dependency, Railway configuration, or production configuration. Focused API
integration typechecking passed and no hard-coded device listener on port 3000
remains in the harness.

## 4. Gate Criterion Matrix

| Criterion | Current result | Evidence from this execution | Remaining proof |
| --- | --- | --- | --- |
| G2-01 both-platform onboarding | **Partial / blocked** | Final-source seven-step onboarding passed on the physical Pixel, including real biometric prompt, SQLCipher enrollment, authoritative version 1, exact disposable-Aiven counts, and privacy-safe completion state. | Complete the same final-source flow on a physical Face ID iPhone. |
| G2-02 airplane-mode restart | **Passed on physical Android; iOS blocked** | With airplane mode physically enabled and the API listener down, LittleArc cold-restarted and opened authoritative emergency-card version 1 from encrypted local state after biometric unlock. | Reconfirm on a physical iPhone to remove platform ambiguity. |
| G2-03 sign-out inaccessibility | **Passed on physical Android; iOS blocked** | The post-recovery OFF-03 sign-out control verified deletion of SQLCipher, encrypted files, key index, enrollment marker, and protected keys. A subsequent emergency-card open returned `This installation is not enrolled`, and final `pm clear` left no app data. | Prove physical-iPhone Keychain/SQLCipher inaccessibility. |
| G2-04 biometric invalidation recovery | **Passed on physical Android; iOS blocked** | After one fingerprint was removed and a replacement enrolled, Expo SecureStore reported the key permanently invalidated and LittleArc required account reauthentication. Synthetic wipe/re-enrollment, authoritative resync, API-down airplane-mode reopen, and terminal sign-out wipe passed without plaintext fallback or crash. | Repeat actual biometric-set mutation, recovery, offline reopen, and wipe on a physical Face ID iPhone. |
| G2-05 two-device conflict | **Outstanding / blocked** | Conditional-revision, conflict, persistence, and Aiven checks passed. | Produce the stale critical-field conflict using two simultaneous physical clients. |
| G2-06 duplicate retry | **Satisfied, automated/Aiven reconfirmed** | Exact replay, mismatch, rollback, audit, change, outbox, and idempotency assertions passed. | Include the accepted physical-client interrupted-response scenario in the two-device run. |
| G2-07 cursor expiry/reset | **Satisfied, automated/Aiven reconfirmed** | Snapshot, pagination, signed cursor, typed expiry/reset, tombstone, pending/conflict, and restart tests passed. | Reconfirm current source on both physical conflict devices. |
| G2-08 server security/privacy | **Passed** | Authentication, RLS, BOLA, revocation, observability allowlist, migration authority, and privacy-canary checks passed on disposable Aiven PostgreSQL 17.10. | No current blocker; retain this result with the final source freeze. |
| G2-09 accessibility/low-end | **Passed on primary Android; iOS/low-end blocked** | At 200% text plus high contrast, the physical Pixel reflowed without clipped critical content and kept all emergency actions reachable. TalkBack touch exploration and double-tap opened the encrypted emergency card and synthetic-number dialer without placing a call. Settings were restored. | Complete VoiceOver on physical iPhone and the approved physical low-end Android matrix. |

Gate 2 remains open. A simulator is not physical iOS evidence, a flagship Pixel
is not low-end Android evidence, and server simulation is not two-device proof.

## 5. Automated And Database Validation

### Focused suites

| Command | Result |
| --- | --- |
| `pnpm --filter @littlearc/mobile test` | Passed — 17 files, 66 tests |
| `pnpm --filter @littlearc/auth test` | Passed — 2 files, 10 tests |
| `pnpm --filter @littlearc/api exec vitest run src --reporter=verbose` | Passed — 3 files, 25 tests |
| `pnpm --filter @littlearc/database test` | Passed — 3 files, 33 tests |
| `pnpm --filter @littlearc/observability test` | Passed — 5 files, 17 tests |
| `pnpm test:contract` | Passed — 2 files, 16 tests |
| `pnpm --filter @littlearc/api typecheck` | Passed, including integration TypeScript |

The package API wrapper initially returned after its prerequisite compilation
without a test verdict in the shell runner. Direct Vitest passed, and the later
root test graph ran the package wrapper successfully with all 25 API tests.

### Disposable Aiven

`pnpm test:database:auth` and `pnpm test:database:rls` passed against Aiven
PostgreSQL 17.10. The shared direct integration harness also passed:

```sh
node --env-file=.env.aiven scripts/run-with-aiven-env.mjs \
  pnpm --filter @littlearc/api exec tsx integration/off-02-household.ts
```

The harness proved the accepted OFF-02 through OFF-05 behavior, including
atomic onboarding, enrollment, exact replay/mismatch, RLS/BOLA, synchronization,
cursor expiry/reset, conflict, emergency-card versions, revocation, canaries,
and the reviewed VLT-04/VLT-05 queue and least-authority migrations already
present in the source state.

Three inactive disposable databases left by interrupted wrapper/device-server
attempts were resolved by exact name, confirmed to have zero sessions, and
dropped. An independent catalog query then returned
`REMAINING_DISPOSABLE_DATABASES=0`.

One repeat read-only catalog probe failed before connecting because the ad-hoc
client omitted the repository harness's `uselibpqcompat=true` handling for
Aiven `sslmode=require`. It made no database change. The corrected TLS-aware
read-only probe passed and again returned
`REMAINING_DISPOSABLE_DATABASES=0`.

### Broad repository gates

| Command | Result |
| --- | --- |
| `pnpm test` | Passed — all 21 task-graph jobs, including API 25, worker 45, and mobile 66 tests |
| `pnpm validate` | Passed — toolchain, workspace, supply-chain/generated migrations, Biome over 342 files, Markdown over 114 documents, documentation, and 20 typecheck tasks |
| `pnpm --filter @littlearc/mobile run doctor` | Passed — 20/20 checks |
| `./tooling/validate-clean-checkout.sh` | Passed — 540-file source-only snapshot, frozen install, generated drift, formatting, 115-document lint, documentation, and 20 typecheck tasks |
| `pnpm check:docs` | Passed |
| `git diff --check` and `git diff --cached --check` | Passed |

## 6. Native And Release-Containment Evidence

- Android development APK: built from the recorded source with
  `:app:assembleDebug`, `arm64-v8a`; Gradle reported `BUILD SUCCESSFUL` after
  615 tasks.
- Pixel 8: APK installation and app-data clear succeeded before the device
  disconnected. The application lifecycle did not begin, so this is build and
  install evidence only.
- Android release export: 29-file generated bundle passed the repository's
  validation-route containment scan.
- iOS release export: 25-file generated bundle passed the same containment
  boundary.
- iPhone 17 Pro Simulator: a clean Xcode compile against simulator
  `7C8183EE-08E8-4F3D-A064-D3C404A10CC9` passed with
  `IOS_SIMULATOR_BUILD_EXIT=0`. The output contained upstream pod/compiler
  warnings but no build error.

No physical iPhone appeared in Xcode's device inventory. Simulator evidence
does not satisfy physical iOS, Secure Enclave, VoiceOver, or two-device
criteria.

## 7. Device Inventory And Stop Event

| Target | Observed state | Result |
| --- | --- | --- |
| Google Pixel 8, Android 17, serial ending `000U7` | Reconnected and stable through onboarding, radio-off restart, 200% text, contrast, TalkBack, actual fingerprint invalidation, recovery, second offline restart, and final wipe | **Passed for the complete primary-Android matrix** |
| Physical Face ID iPhone | Not present in Xcode inventory | **Blocked — external device required** |
| Approved physical low-end Android | Not present and target model not recorded | **Blocked — product target and device required** |
| iPhone 17 Pro Simulator, iOS 26.5 | Available | Regression/build aid only |

The local synthetic API had reached ready state on `127.0.0.1:3001`, Metro was
ready on `8082`, and the required ADB reverse rules had been configured before
the Pixel disappeared. The waiting launch was stopped; Metro and the API were
then stopped. No device scenario or biometric mutation was attempted after the
disconnect.

### Resumed Physical Pixel Run

The same Pixel reconnected as an authorized USB device on 26 July 2026. It
remained stable throughout the resumed run:

1. the current development client loaded from Metro with API origin
   `http://127.0.0.1:3001`;
2. the seven-step OFF-06 shell passed with fixed synthetic data, the native
   Android biometric prompt, SQLCipher, authoritative emergency-card version
   1, and exact disposable-Aiven evidence;
3. airplane mode was enabled, the API listener was stopped, the process was
   force-stopped, and a cold launch opened the encrypted offline card;
4. at font scale `2.0` plus high text contrast, the home and card screens
   reflowed, remained scrollable, and exposed the emergency contact, dialer,
   version, and edit controls;
5. TalkBack `17.0.1.926549743` was enabled; touch exploration plus double-tap
   opened the card and then the synthetic guardian dialer action without
   placing a call; and
6. the log scan found no LittleArc fatal/error pattern or fixed synthetic
   payload canary. A historical fatal line was confirmed to belong to the
   unrelated package `com.infrasoft.uboi`.

The Pixel reported four enrolled fingerprints before and after the attempted
mutation setup. Android's enrollment screen reached the PIN confirmation
boundary, but no PIN was supplied and no fingerprint was added. This is not
actual biometric-invalidation evidence.

The device owner later reported completing enrollment. The app was terminated
before the decisive check, but Android still reported four enrolled
fingerprints. On relaunch, the pre-existing `requireAuthentication` entry
accepted a real fingerprint prompt and opened the retained encrypted emergency
card. Because Android and Expo document that a new biometric enrollment should
make this key inaccessible, execution stopped without running recovery or
claiming G2-04. The app was terminated again and the fingerprint settings PIN
screen was reopened for an explicit remove-one/add-one replacement.

The device owner then removed one existing fingerprint and enrolled a
replacement for the same finger, returning the count from three to the baseline
four. With LittleArc terminated before the change, the decisive relaunch
produced both:

- `The requested key has been permanently invalidated. Returning null` from
  Expo SecureStore; and
- the app-visible fail-closed state `Encrypted card unavailable. Account
  reauthentication is required before synchronization.`

The development-only OFF-06 boundary then removed unrecoverable synthetic
ciphertext, created a fresh protected generation, replayed device enrollment,
and resynchronized authoritative emergency-card version 1. With the API
stopped and airplane mode enabled, a force-stop and cold relaunch opened the
new encrypted offline copy after biometric authentication.

Finally, the OFF-03 lifecycle reached its named `Sign out and verify local
wipe` control. It reported `all OFF-03 local artifacts wiped`; the database
directory no longer existed, and a subsequent emergency-card open returned
`This installation is not enrolled.` Final app-data clear removed the
remaining development-client files.

## 8. Privacy, Security, And Cleanup

- Only existing fixed synthetic identities, household, child, contact, and
  emergency-card fixtures were used.
- No real document, medical, participant, household, or child data was
  processed or introduced.
- Privacy canary and operational-state assertions passed.
- Railway and production were not selected, queried, changed, or deployed.
- No listeners remain on local ports `3001` or `8082`.
- All observed disposable Aiven databases were dropped; the independent
  remaining count is zero.
- Airplane mode returned to `0`, font scale to `1.0`, high text contrast to
  `0`, and accessibility services to disabled.
- TalkBack was enabled only for the bounded workflow and then disabled.
- ADB reverse rules and temporary on-device XML observations were removed.
- The OFF-03 sign-out wipe passed, and final application-data clear removed all
  remaining LittleArc files, databases, and shared preferences.
- The fingerprint count returned to its baseline of four after the
  remove-one/add-one replacement.

## 9. External Blockers And Resume Procedure

Before device execution resumes:

1. connect an approved dedicated physical Face ID iPhone with working
   development signing;
2. record and connect the product-approved physical low-end Android target;
3. confirm the iPhone biometric test profile may be changed and restored;
4. verify and remove stale device transport rules and synthetic app state;
5. rebuild/reinstall from the then-current frozen source if any relevant file
   changed; and
6. execute G2-01 through G2-07 and G2-09 exactly as specified in the accepted
   plan, then rerun broad gates and cleanup.

Do not mark M2 or Gate 2 complete until the evidence matrix has no partial,
outstanding, blocked, or deferred criterion and the founder accepts closure.

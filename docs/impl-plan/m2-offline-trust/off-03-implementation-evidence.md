# OFF-03 Implementation Evidence

> **Status:** Accepted
> **Last updated:** 22 July 2026
> **Owner:** Engineering
> **Work package:** `OFF-03`
> **Plan:** [OFF-03 Local Security and Enrollment](./off-03-local-security-and-enrollment-plan.md)
> **Decision:** [ADR-0011](../../adr/0011-local-key-custody-app-lock-and-device-enrollment.md)

---

## 1. Implemented Outcome

LittleArc now has a synthetic-only local-security and device-enrollment
lifecycle. An authenticated household member can register an authority-neutral
installation, create and reopen a forward-migrated SQLCipher database with a
device-bound random key, protect local access with strong biometrics, use
independently authenticated encrypted files, recover from unavailable protected
key material through reauthentication and a fresh local generation, and sign
out without leaving OFF-03 artifacts.

This package does not implement OFF-04 repositories/synchronization, OFF-05
emergency-card policy, real household data, or a live reauthentication provider.

## 2. Implemented Boundary

- `POST /v1/devices/enrollment` derives global identity, membership actor, and
  household from the accepted OFF-01/OFF-02 server boundary. The request cannot
  choose authority and the device row grants none.
- The PostgreSQL command creates or exactly replays an active enrollment and
  atomically appends minimized audit and outbox evidence. Cross-identity reuse
  and revoked-device reenrollment fail closed.
- The mobile app creates a random 256-bit SQLCipher raw key, stores it through
  device-only SecureStore with biometric protection, verifies SQLCipher before
  migration, migrates on the already-keyed connection, enables WAL, and proves
  reopen plus wrong-key rejection.
- Local schema V1 reserves enrollment, child/emergency projections, mutation,
  sync, tombstone, and encrypted-file metadata without implementing OFF-04 or
  OFF-05 behavior.
- Every local validation file uses an independent AES-256-GCM key, random nonce,
  immutable AAD, opaque filename, SQLCipher metadata, and deterministic key,
  metadata, and ciphertext cleanup.
- Protected-key loss enters `reauthentication_required`. The development flow
  labels key deletion as simulated invalidation, wipes unrecoverable ciphertext,
  creates a fresh generation, and exactly replays server enrollment.
- The sign-out coordinator makes local cleanup unconditional even when remote
  sign-out fails. Wipe verification checks the database, WAL/SHM sidecars,
  encrypted-file directory, key index, enrollment marker, and protected keys.

## 3. Security and Runtime Review

Review found and corrected orphan-key cleanup paths for database enrollment and
encrypted-file setup, documented SecureStore's actual biometric-only Android
prompt behavior, added the real HTTP 403 response to OpenAPI, and expanded wipe
verification to SQLite sidecars.

Physical-device validation then found two Android/native integration defects
that unit tests could not exercise:

1. Expo FileSystem requires an absolute `file://` URI when inspecting Expo
   SQLite's raw Android database directory. The wipe verifier now normalizes the
   path, and the device proved stale database/sidecar cleanup.
2. Expo SQLite exclusive transactions create another native connection. An
   unkeyed connection cannot migrate an encrypted database and failed closed as
   `file is not a database`. Local migrations now use the existing keyed
   connection, and ADR-0011 records that constraint.

The final device run reported SQLCipher `4.7.0 community`; schema V1, wrong-key,
wrong-AAD, ciphertext-tamper, recovery, and wipe checks all passed.

## 4. PostgreSQL Integration Evidence

The Aiven PostgreSQL harness created a fresh temporary database, applied the
reviewed migrations, retained the OFF-02 regression suite, and proved:

1. session-derived first enrollment and exact active replay;
2. app-version metadata update without authority change;
3. cross-identity device collision rejection;
4. revoked-device reenrollment rejection;
5. transaction rollback when operational evidence fails;
6. household RLS isolation under the application role; and
7. minimized `device_enrolled` audit plus outbox evidence.

The physical harness exercised the same HTTP/database command repeatedly during
initial enrollment and recovery. Controlled shutdown dropped its temporary
database; a provider query found zero remaining `littlearc_off02_%` databases.

## 5. Validation Results

All commands use Node.js 24.18.0 and pnpm 11.14.0.

| Validation | Result |
| --- | --- |
| Focused domain, contracts, database, API, and mobile tests | Passed; 70 focused tests, including 9 local-security policy/migration tests. |
| `pnpm --filter @littlearc/api test:postgres` | Passed; OFF-02 regression plus OFF-03 enrollment, replay, collision, revocation, rollback, RLS, audit, and outbox cases. |
| Physical Android local-security lifecycle | Passed on Pixel 8, Android 17/API 37, through the installed development client and real temporary PostgreSQL command. |
| `pnpm check:generated` twice | Passed; generated OpenAPI document, JSON, and types are idempotent and drift-free. |
| `pnpm test` | Passed; 138 tooling, unit, and contract tests across the workspace. |
| `pnpm build` | Passed; package/server/staff builds and Android/iOS Hermes exports completed. |
| `pnpm --filter @littlearc/mobile run doctor` | Passed all 20 Expo project checks. |
| `pnpm validate` | Passed; toolchain, workspace, supply-chain, generated output, formatting, documentation, and 13-package typechecks passed. |
| `git diff --check` | Passed. |
| `./tooling/validate-clean-checkout.sh` | Passed from a source-only snapshot with frozen install and uncached workspace validation. |

## 6. Physical Android Evidence

The attached Pixel 8 reported strong biometric readiness with two supported
authentication types. The accessible development-only route then completed:

1. capability inspection and session-derived HTTP device enrollment;
2. protected SQLCipher-key creation and schema V1 migration;
3. biometric unlock, keyed reopen, and wrong-key rejection;
4. independent file encryption plus wrong-AAD and tamper rejection;
5. simulated protected-key invalidation and required reauthentication state;
6. local ciphertext removal, fresh-generation enrollment, keyed reopen, and
   exact server replay; and
7. sign-out wipe with no database, sidecar, encrypted-file, or key artifacts.

UIAutomator observed the final `OFF-03 physical Android validation passed`
semantic state, and the screenshot was visually reviewed. The LittleArc process
remained alive. A bounded logcat scan found no fatal Android or React Native
runtime matches. Metro/API listeners were stopped and both ADB reverse tunnels
were removed.

## 7. Evidence Boundaries

The run used only synthetic IDs and a temporary database. It does not claim:

- real parent, child, participant, health, file, or consent data;
- a live email/social-provider reauthentication flow;
- an actual OS biometric-set change or reinstall-driven key invalidation;
- physical iOS, signed-store, install/upgrade/reinstall, rooted-device, or the
  complete pre-pilot device matrix;
- OFF-04 synchronization, persisted offline mutations, conflict handling, or
  unsynchronized-write recovery; or
- OFF-05 emergency-card content or quick-access policy.

## 8. Completion Decision

**Decision: COMPLETE.** OFF-03 meets its synthetic boundary through reviewed
key custody and authority rules, adversarial PostgreSQL integration, repository
gates, and a complete physical Pixel 8 native lifecycle. OFF-04 planning is
ready next; the real-data, provider, physical-iOS, and pre-pilot obligations
remain unchanged.

## iOS Simulator Parity Follow-Up — 23 July 2026

The production custom development client passed capability, enrollment,
SQLCipher V3, matching simulated Face ID unlock, wrong-key/AAD/tamper
rejection, key invalidation, recovery/re-enrollment, resynchronization, and
sign-out wipe against a fresh disposable Aiven database. Simulated Face ID
does not prove physical Secure Enclave behavior. See the
[cross-milestone parity dossier](../ios-simulator-parity-validation-evidence.md).

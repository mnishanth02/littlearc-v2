# OFF-03 Local Security and Enrollment

> **Status:** Complete
> **Started date:** 22 July 2026
> **Last updated:** 22 July 2026
> **Completion date:** 22 July 2026
> **Owner:** Engineering
> **Milestone:** M2
> **Work package:** `OFF-03`
> **Depends on:** Accepted Gate 1, `OFF-01`, and `OFF-02`
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
> **Inputs:** [roadmap](../roadmap.md),
> [architecture](../../core/littlearc-architecture-and-tech-stack.md),
> [mobile flow](../../core/mobile-application-flow.md), and
> [OFF-02 boundary](./off-02-household-parent-child-consent-and-audit-plan.md)

---

## Outcome

An authenticated household member can enroll one physical installation, create
an encrypted forward-migrated local database, protect its random key behind the
device app-lock policy, use independently encrypted local files, recover safely
when protected key material is invalidated, and sign out without leaving
sensitive local data accessible.

## Scope

- Add a session-authenticated, household-derived device-enrollment command. A
  device row records an installation but grants no household authority.
- Generate random 256-bit SQLCipher and local-file keys on device. Store them
  only through device-bound SecureStore; never derive them from a PIN,
  biometric, session token, user identifier, or household identifier.
- Add a versioned SQLCipher schema and transactionally applied forward local
  migrations for enrollment metadata, read-model placeholders, encrypted-file
  metadata, mutation/outbox placeholders, sync state, and tombstones.
- Verify SQLCipher activation, wrong-key rejection, close/reopen behavior, WAL,
  migration idempotence, and rollback semantics.
- Add an explicit strong-biometric app-lock policy for protected key access.
  Account reauthentication is the recovery path; do not add a custom PIN,
  device-credential bypass, or plaintext key fallback.
- Classify an enrolled installation whose protected key is unavailable as
  requiring account reauthentication and safe resynchronization. Clear
  unrecoverable ciphertext before rebuilding local state.
- Add AES-256-GCM local-file primitives with a fresh per-file key, random
  96-bit nonce, immutable AAD, opaque filenames, authentication-tag checking,
  and explicit deletion.
- Add sign-out cleanup that closes repositories, deletes the SQLCipher database
  and encrypted-file directory, and removes OFF-03 SecureStore entries even
  when remote sign-out/revocation cannot complete.
- Add a development-only synthetic Android validation flow covering capability
  inspection, enrollment, biometric unlock, encrypted database/file checks,
  simulated protected-key invalidation, synthetic reauthentication/resync, and
  verified sign-out wipe.

## Out Of Scope

- OFF-04 repository refresh, mutation push/pull, conflicts, cursor recovery,
  or multi-device synchronization.
- OFF-05 emergency-card content or quick-emergency-access policy.
- Real parent, child, record, file, or participant data.
- Live email/social-provider reauthentication, store distribution, physical
  iOS, actual biometric-set mutation on the user's phone, rooted-device
  resistance, or the complete pre-pilot capability matrix.
- Remote device revocation UI and caregiver enrollment; the server command
  supports the current authenticated member only.
- Preserving unsynchronized future mutations during sign-out. OFF-04 must add a
  reviewed warning/recovery policy before real local writes exist.

## Dependencies

- OFF-01 supplies the authenticated identity and recent-reauthentication
  boundary. The physical validation harness may inject only its named local
  synthetic identity.
- OFF-02 supplies the active household membership and authorization-neutral
  `devices` table. Enrollment must derive household and actor from that row.
- Expo SQLite is already configured with SQLCipher, and Expo SecureStore,
  LocalAuthentication, Crypto, and FileSystem are already accepted native
  dependencies in the production mobile app.
- Physical acceptance uses the attached Pixel 8 development client and a
  temporary synthetic Aiven PostgreSQL database.

## Module Status

| Module | Status | Notes |
| --- | --- | --- |
| Plan and security review | Completed | Key custody, lock policy, invalidation, wipe order, device authority, and evidence boundary finalized. |
| Shared contracts and domain policy | Completed | Minimal authority-neutral enrollment contract and lifecycle policy are implemented and generated. |
| PostgreSQL device command | Completed | Session-derived enrollment, exact replay, audit/outbox, RLS, collision, revocation, and rollback cases pass. |
| Mobile SQLCipher and migrations | Completed | Random raw 256-bit key, keyed-connection schema V1 migration, WAL, reopen, wrong-key rejection, and verified wipe pass. |
| App lock and recovery | Completed | Strong-biometric capability, protected key access, invalidation classification, and fresh-generation recovery pass on Pixel 8. |
| Local encrypted files | Completed | Independent AES-256-GCM file keys, opaque names, AAD/tamper rejection, metadata, and cleanup pass. |
| Automated and physical validation | Completed | Focused, Aiven, root, build, validation, clean-checkout, and complete Pixel 8 lifecycle evidence pass. |

## Implementation Plan

1. Accept ADR-0011 for key custody, app-lock policy, invalidation recovery,
   sign-out cleanup, local schema ownership, encrypted files, and the rule that
   device identity never grants household authority.
2. Extend domain/contracts with the device lifecycle and a minimal
   `POST /v1/devices/enrollment` request/response. Accept only UUIDv7 device
   IDs, `android`/`ios`, bounded app versions, and a fixed local-schema version.
3. Implement the PostgreSQL command and route. Resolve the active membership
   from the OFF-01 identity, set transaction-local tenant context, insert or
   replay the device enrollment, reject cross-identity/revoked reuse, and append
   minimized audit/outbox evidence in the same transaction.
4. Implement a mobile local-security policy module with pure lifecycle and
   migration tests. Keep native adapters separate so policy tests do not need a
   simulator.
5. Implement the native SQLCipher store. Generate the key with Expo Crypto,
   store it with device-only SecureStore access and app-lock protection, apply
   ordered migrations transactionally, enable WAL, and reject missing SQLCipher
   or a wrong key before repositories mount.
6. Implement local encrypted-file primitives with a random key per opaque file,
   AES-256-GCM, AAD-bound metadata, ciphertext-only files, SQLCipher metadata,
   tamper rejection, and deterministic cleanup.
7. Implement app-lock enrollment/unlock and recovery. Require enrolled strong
   biometrics for the biometric policy, distinguish user cancellation from
   invalidated/missing key material, and
   require account reauthentication before wiping and rebuilding local state.
8. Implement unconditional local sign-out cleanup and verify all OFF-03
   SecureStore keys, database files, sidecars, encrypted files, and in-memory
   handles become unavailable.
9. Add a development-only physical validation route and temporary Aiven
   harness. Exercise the actual SQLCipher, SecureStore, biometric prompt,
   AES-GCM, FileSystem, HTTP, RLS, audit, outbox, invalidation branch, reenroll,
   and sign-out-wipe paths using synthetic values only.
10. Run focused tests, PostgreSQL integration, generated-contract drift checks,
    root tests/build/validation, Expo Doctor, Android/iOS exports, clean-checkout
    proof, physical Android completion, logcat leakage/fatal scans, and final
    diff review before recording completion.

## Acceptance Criteria

- Device enrollment requires an authenticated identity with one active
  household membership. The request cannot choose the user, household, actor,
  role, or enrollment status, and a device row never authorizes resource access.
- The server atomically creates or exactly replays the active device row plus a
  minimized audit event and outbox event. Cross-identity device reuse and
  reactivation of a revoked device fail closed.
- The SQLCipher key is 256 random bits, held only in device-bound SecureStore,
  and protected by the configured app-lock policy. It is never logged,
  persisted in SQLite, derived from user input, or returned by an API.
- The local database reports an active SQLCipher version, rejects the wrong
  key, enables WAL, applies forward migrations transactionally and idempotently,
  and does not mount domain repositories until unlock succeeds.
- Every local file has an opaque filename, independent random AES-256-GCM key
  and nonce, immutable AAD, and authenticated ciphertext. Wrong AAD, changed
  ciphertext, or another file key cannot produce plaintext.
- Strong biometric capability/enrollment is checked before enabling biometric
  lock. Cancellation leaves data locked; unavailable protected key material on
  an enrolled install enters `reauthentication_required`, never an unprotected
  fallback.
- Reauthentication/resync removes unrecoverable local ciphertext and creates a
  fresh key/database generation before server-authoritative data may be loaded.
- Sign-out cleanup runs regardless of remote sign-out outcome and leaves no
  readable local database, encrypted-file cache, or OFF-03 key material.
- The attached Android proof drives the complete synthetic flow through actual
  native APIs and the real HTTP/PostgreSQL command. Simulated key invalidation
  is labeled separately from an actual OS biometric-enrollment change.

## Validation

- Domain, contract, database, API, and pure mobile local-security unit tests.
- Aiven PostgreSQL device enrollment, exact replay, cross-identity rejection,
  revoked-device rejection, RLS isolation, audit, outbox, and rollback cases.
- SQLCipher create/migrate/reopen/wrong-key/WAL/rollback checks and AES-GCM
  round-trip/wrong-AAD/tamper/cross-key checks in the mobile dev client.
- Physical Pixel 8 strong-biometric unlock, synthetic invalidation recovery,
  reenrollment, sign-out wipe, process survival, accessibility semantics, and
  logcat fatal/sensitive-canary review.
- Generated-output drift twice, root test/build/`pnpm validate`, Expo Doctor,
  `git diff --check`, documentation checks, and clean-checkout proof using Node
  24.18.0 and pnpm 11.14.0.

## Evidence

The live [OFF-03 implementation evidence](./off-03-implementation-evidence.md)
records the automated, PostgreSQL, and physical-Android acceptance boundary.
Completion remains bounded to synthetic data and the recorded Pixel 8 scenario.

## Risks And Blockers

| Risk or blocker | Control | Resolution trigger |
| --- | --- | --- |
| SecureStore key loss is treated as silent permanent data loss | Explicit invalidation state, account reauthentication, local wipe, and server-authoritative rebuild. | Physical synthetic recovery passes. |
| Device ID becomes an authorization token | Derive tenant and actor from session membership; keep device metadata authority-neutral. | API/RLS adversarial tests pass. |
| SQLCipher is configured but plaintext SQLite opens | Require `cipher_version`, wrong-key rejection, and keyed reopen before mounting repositories. | Native runtime checks pass. |
| Biometric lock blocks emergency access | Keep quick emergency access in OFF-05 and make no silent product-policy choice here. | OFF-05 plan reviews the explicit modes. |
| Sign-out leaves sidecars or file keys | Close first, remove DB/sidecars/files, remove keys, then verify absence. | Device sign-out-wipe proof passes. |
| Future offline mutations would be discarded | OFF-03 contains no user mutation data; add a reviewed warning/recovery policy in OFF-04. | OFF-04 introduces persisted mutations. |
| Automated invalidation overclaims OS behavior | Label key deletion as simulated invalidation; retain actual biometric-set mutation in pre-pilot evidence. | Named device-matrix test changes enrollment and proves OS invalidation. |

## Decisions

- Use one protected SQLCipher key per local enrollment generation and one
  independent key per encrypted local file.
- Store key material only through device-bound SecureStore with no AsyncStorage,
  custom PIN, or derivation fallback.
- Treat the server as authoritative after local-key invalidation; ciphertext
  without its protected key is deleted before a clean resynchronization.
- Keep enrollment idempotent by device UUID while active, but never reactivate a
  revoked device through the enrollment endpoint.
- Validate actual strong-biometric unlock on Android, while preserving the
  actual biometric-set-change scenario for the named pre-pilot matrix.

## Follow-Up

- OFF-04 consumes the unlocked SQLCipher boundary for repositories, sync,
  conflicts, cursor recovery, tombstones, and unsynchronized-write policy.
- OFF-05 chooses and validates standard versus quick emergency access.
- The pre-pilot matrix must still cover physical iOS, actual biometric-set
  mutation, install/upgrade/reinstall, lower-memory Android, and signed builds.

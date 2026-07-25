# ADR-0011: Local Key Custody, App Lock, and Device Enrollment

> **Status:** Accepted
> **Date:** 2026-07-22
> **Owner:** Engineering
> **Review date:** 2026-10-22
> **Supersedes:** None
> **Superseded by:** None
> **Related documents:** [OFF-03 plan](../impl-plan/m2-offline-trust/off-03-local-security-and-enrollment-plan.md), [architecture](../core/littlearc-architecture-and-tech-stack.md), [mobile flow](../core/mobile-application-flow.md), and [VLT-03 evidence](../impl-plan/m3-vault-wedge/vlt-03-implementation-evidence.md)

---

## Context

LittleArc needs an encrypted offline read model before repository or emergency-
card behavior can be implemented. The device must protect database and file key
material, distinguish a locked app from invalidated key custody, remove local
sensitive state on sign-out, and register the installation without allowing a
client device identifier to become household authority.

## Decision

- Generate a random 256-bit SQLCipher key for each local enrollment generation.
  Store it only in device-bound SecureStore with app-lock protection; never
  derive it from a PIN, biometric, session, user, household, or device ID.
- Enable strong biometric app lock only after hardware and enrollment checks.
  Use the platform biometric cryptographic prompt; account reauthentication is
  the recovery path. Add no LittleArc PIN, device-credential bypass, or
  plaintext key fallback.
- Treat enrolled metadata plus unavailable protected key material as
  `reauthentication_required`. After OFF-01 account reauthentication, close and
  remove unrecoverable ciphertext, create a fresh key/database generation, and
  resynchronize from the server-authoritative model.
- Own ordered, forward-only local migrations in the mobile application. Require
  SQLCipher activation and correct-key reopen before mounting repositories, and
  enable WAL only after the cipher key is applied. Run migration transactions
  on that keyed connection; do not use Expo SQLite exclusive transactions,
  which create a second unkeyed native connection.
- Encrypt every local cached file independently with AES-256-GCM, a fresh key
  and nonce, immutable context AAD, opaque filenames, and metadata in SQLCipher.
  Wrap each random file key with an AES-256-GCM key domain-separated from the
  protected SQLCipher key, and store only that authenticated envelope in
  SQLCipher. Keep the unlocked database and wrapping keys only in a coalesced
  foreground session; clear that session and plaintext previews when the app
  enters the background.
- On sign-out, attempt remote session handling but never make local cleanup
  conditional on the network result. Close handles, delete SQLCipher and file
  ciphertext, then remove OFF-03 SecureStore entries and verify absence.
- Enroll the device through a session-authenticated API that derives the active
  household membership server-side. Device metadata supports lifecycle and
  audit but grants no role, capability, tenant, or resource authority.

## Alternatives Considered

- Derive a database key from an app PIN: rejected because it weakens entropy,
  creates credential-recovery burden, and contradicts the accepted architecture.
- Keep an unprotected backup key for biometric invalidation: rejected because
  it silently bypasses the app lock and increases local extraction risk.
- Preserve inaccessible ciphertext indefinitely: rejected for the current
  server-authoritative read model because it complicates recovery and leaves
  sensitive remnants without a usable restoration path.
- Use one key for the database and every file: rejected because independent
  file keys reduce blast radius and support later per-object lifecycle.
- Trust a device ID as household authorization: rejected because installation
  identity is client-held metadata and cannot replace session, membership,
  capability, and RLS checks.

## Consequences

Users can recover from biometric-key invalidation by authenticating again and
rebuilding local state, but unavailable offline-only changes cannot be restored.
OFF-04 must therefore define unsynchronized-write warnings before real offline
mutations exist. App lock may be unavailable on devices without suitable secure
authentication; those devices cannot enable the protected enrollment policy.
Device enrollment adds auditability without broadening authorization.

## Validation

Unit tests cover lifecycle classification, ordered migrations, replay policy,
cleanup ordering, and file-envelope metadata. PostgreSQL integration covers
session-derived membership, RLS, exact replay, revoked/cross-identity rejection,
audit, outbox, and rollback. Physical Android validation covers SQLCipher,
SecureStore, a strong-biometric prompt, AES-GCM files, simulated invalidation,
synthetic reauthentication/resync, and verified sign-out wipe.

VLT-03 exercised the encrypted-file lifecycle review trigger on 24 July 2026.
The accepted primitive now protects capture originals, normalized images, and
thumbnails with separate keys, immutable purpose-bound AAD, opaque names, and
SQLCipher metadata. Physical Pixel 8 validation on 25 July exposed a prompt
storm because repeated database and per-file SecureStore reads each created an
independent biometric request. SQLCipher schema V7 now stores authenticated
file-key envelopes, derives a distinct wrapping key for the foreground
session, coalesces concurrent unlock requests, and lazily migrates legacy
per-file SecureStore keys. Plaintext remains staging-only, deletion keeps
recoverable metadata until file/key cleanup succeeds, and VLT-03 adds no
transport/server key wrapping, upload, server-object, or record-authority
semantics. The original independent-file-key decision therefore remains
accepted.

## Review Triggers

Review by 2026-10-22, or earlier when OFF-04 adds persisted local mutations,
OFF-05 selects quick emergency access, key custody moves to another native
boundary, device attestation becomes a requirement, actual biometric-set
invalidation diverges on the supported matrix, or encrypted-file lifecycle
needs upload/key wrapping.

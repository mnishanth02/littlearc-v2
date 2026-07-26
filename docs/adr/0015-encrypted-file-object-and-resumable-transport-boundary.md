# ADR-0015: Encrypted File Object And Resumable Transport Boundary

> **Status:** Accepted
> **Date:** 2026-07-25
> **Owner:** Engineering
> **Review date:** 2026-10-25
> **Supersedes:** None
> **Superseded by:** None
> **Related documents:** [VLT-04 plan](../impl-plan/m3-vault-wedge/vlt-04-file-encryption-and-resumable-upload-plan.md),
> [ADR-0010](./0010-household-membership-encryption-and-consent-boundary.md),
> [ADR-0011](./0011-local-key-custody-app-lock-and-device-enrollment.md)

---

## Context

VLT-03 protects each captured source with an independent AES-256-GCM key on
the enrolled device. VLT-04 must move that protected source through an
S3-compatible object store without proxying file bytes through the API,
persisting plaintext keys, losing restart progress, or implying that storage
completion makes an unvalidated document safe.

The design must preserve household/child authorization, active-device
enrollment, RLS, bounded mobile memory/cache use, short-lived signed
capabilities, provider-independent tests, and a cleanup path for multipart
uploads when no bucket lifecycle rule is available.

## Decision

LittleArc uses one upload-ready AES-256-GCM ciphertext per original capture
asset. Its canonical AAD is versioned JSON containing the household ID,
immutable client-allocated UUIDv7 file-object ID, `capture-original` purpose,
declared format, and protocol identifier. New captures use this AAD directly;
legacy VLT-03 files are resealed to a fresh key and opaque ciphertext before
their first upload, with metadata switched only after the replacement is
durable.

The client sends the per-file key only when creating an authenticated upload
session. The API validates household, child, capability, and active originating
device, wraps the key immediately under the household key, clears its mutable
buffer, and stores only the wrapped key plus nonce/tag and ciphertext
metadata. This is envelope encryption with API-authorized key release, not
end-to-end or zero-knowledge encryption.

`@littlearc/storage` owns provider-specific multipart behavior. The mobile app
uploads fixed 5 MiB non-final ciphertext parts through ten-minute signed URLs
and stores only session IDs, part numbers, sizes, and ETags in SQLCipher V8.
It reconciles provider `ListParts` truth after interruption, refreshes signed
URLs rather than persisting them, and removes each opaque temporary part in a
`finally` path.

Completion requires an ordered provider part set and an independent streamed
full-object byte-count and SHA-256 match. Only then does PostgreSQL create a
`file_objects` row with `upload_state=uploaded` and
`validation_state=pending`. VLT-04 does not create record links or grant
document-safety authority.

Download requires current household access and an active enrolled device. The
API unwraps the file key transiently and returns it with a five-minute signed
ciphertext URL. The device verifies size, SHA-256, nonce/tag, and authenticated
AAD before importing the ciphertext and wrapping its key locally.

Expired sessions are claimed in small batches through security-definer
database functions. The worker receives only session ID, opaque object key,
and provider upload ID; it has no table, household-key, or file-key read
authority. Abort is idempotent and terminal expiry is recorded only after the
provider cleanup succeeds.

Uploads are controlled by `UPLOADS_ENABLED`, false by default. Enabling the
flag without a fully composed storage/auth/database/key-wrapping boundary
makes API readiness fail closed.

## Alternatives Considered

- Proxy plaintext or ciphertext through the API. Rejected because it expands
  API bandwidth, memory, timeout, and sensitive-data exposure.
- Encrypt a second upload copy. Rejected because duplicate ciphertext and key
  lifecycle state create unnecessary storage and cleanup risk.
- Treat multipart ETags as the file digest. Rejected because provider ETags
  are not a portable full-object SHA-256 integrity proof.
- Persist signed URLs for offline retry. Rejected because URLs are short-lived
  transport capabilities and provider state can be reconciled safely.
- Link uploaded files directly to records. Rejected because upload completion
  does not validate file structure, content safety, or clinical meaning.
- Give the worker table access. Rejected because expiry cleanup needs only
  opaque provider identifiers.
- Claim end-to-end encryption. Rejected because the API intentionally has
  bounded key-wrapping and authorized-download authority.

## Consequences

Uploads resume without retransmitting provider-confirmed parts, local source
ciphertext survives failures and cancellation, and storage behavior can be
tested deterministically without a live provider. Household/object binding,
RLS, active-device checks, independent digest validation, and minimal worker
authority reduce cross-tenant, tamper, and orphan risks.

The API temporarily handles a plaintext file key during create/download.
Large captures still require bounded foreground app work; VLT-04 does not add
an OS background-transfer service. Full-object verification adds one provider
read after multipart completion. Existing VLT-03 originals require a one-time
reseal, and object storage needs CORS support for mobile `PUT`, `GET`, and
exposed `ETag`.

Document safety, malware scanning, derivative previews, OCR, record linking,
and search remain later work packages.

## Validation

- Unit tests cover AAD/key wrapping, storage multipart ordering, idempotent
  abort, API completion and kill-switch behavior, SQLCipher resumable facts,
  and worker cleanup.
- Disposable Aiven validation applies migration
  `0006_vlt_04_file_upload.sql` and exercises wrapped-key persistence,
  completion/digest verification, RLS/BOLA, revoked-device denial, audit, and
  least-authority expiry cleanup.
- Railway staging validates the S3-compatible adapter, reviewed migration,
  API/worker deployments, feature switch, provider cleanup, and health.
- Physical Android and iOS Simulator runs validate applicable local encryption,
  restart/retry/cancel, upload/download, tamper, cleanup, and accessibility
  behavior using synthetic sources only.

## Review Triggers

Review by 2026-10-25, or earlier if the object provider changes, native
background transfer is proposed, maximum file size increases, key hierarchy or
rotation changes, physical-iOS acceptance begins, document retention changes,
or a zero-knowledge/end-to-end encryption claim is considered.

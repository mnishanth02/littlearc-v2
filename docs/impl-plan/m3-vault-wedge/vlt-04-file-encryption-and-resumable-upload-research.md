# VLT-04 File Encryption And Resumable Upload Research

> **Status:** Reviewed for planning
> **Date:** 2026-07-25
> **Owner:** Engineering
> **Work package:** `VLT-04`

## Summary

VLT-03 already creates an independent random AES-256-GCM key for each captured
asset, stores only ciphertext in app-private storage, and wraps the file key
under the accepted local foreground key. VLT-04 should preserve that
single-encryption boundary instead of decrypting and encrypting a second upload
copy. New captures can be sealed directly with a versioned transport AAD that
binds the household, immutable file-object ID, asset purpose, and format.
Existing VLT-03 drafts can be upgraded atomically before their first upload.

The accepted architecture requires direct resumable ciphertext upload, a full
SHA-256 ciphertext digest, immediate server-side wrapping of the transient file
key, opaque object names, and device-side decryption after an authorized
download. It does not describe end-to-end encryption: the API briefly receives
the file key over authenticated TLS and may unwrap it for an authorized,
enrolled-device download. The API must never log, persist, or cache plaintext
file keys.

Railway's S3-compatible Buckets support multipart upload and presigned URLs, but
do not provide lifecycle configuration. VLT-04 therefore needs application
cleanup for expired multipart sessions; relying on a provider lifecycle rule
would leak incomplete parts. The existing empty
`littlearc-documents-staging` bucket is suitable for staging-only synthetic
acceptance after the implementation plan is approved.

## Existing Boundaries

| Capability | Current state | VLT-04 disposition |
| --- | --- | --- |
| Local ciphertext | VLT-03 AES-256-GCM files with independent keys | Reuse ciphertext after upgrading to transport AAD |
| Local key custody | File keys are wrapped under the foreground-derived local wrapping key | Retain; expose narrowly scoped unwrap/rewrap operations |
| Persistent local metadata | SQLCipher V7 capture drafts/assets and wrapped file keys | Add V8 upload-session and part state |
| Household key hierarchy | Accepted server-side envelope encryption in `@littlearc/crypto` | Add a provider-neutral file-key wrap interface |
| API authorization | Better Auth session, household capability, BOLA, and RLS patterns | Require active session, household capability, active child, and active enrolled device |
| Object storage | Railway staging documents bucket exists but is not wired into application code | Add a provider-neutral storage package and S3 adapter |
| Worker | Safe heartbeat/runtime shell only | Add bounded expired-session cleanup without decryption authority |
| Contracts | `/v1/files` is reserved to M3 | Activate create, reconcile, complete, cancel, and download contracts |

## Provider And Protocol Findings

### Railway Buckets

- The S3-compatible surface includes object and multipart operations needed by
  this package: put/get/head/delete/list, multipart initiation, part upload,
  completion, and abort.
- Railway recommends presigned URLs when a client should upload directly.
- Buckets currently do not expose server-side encryption, versioning, object
  locks, or lifecycle configuration. LittleArc must encrypt before upload and
  must explicitly abort incomplete multipart uploads.
- The staging project currently has an empty
  `littlearc-documents-staging` bucket in the Singapore region. Production
  remains unprovisioned and outside this package.

### S3 Multipart Semantics

- Multipart completion is defined by ordered part numbers and provider-returned
  ETags. An ETag must not be treated as a content MD5.
- The minimum non-final part size is 5 MiB and the maximum part count is 10,000.
  A fixed 5 MiB part size is sufficient for LittleArc's accepted 25 MB
  plaintext limit.
- A client must complete or abort every initiated multipart upload. The server
  should reconcile its persisted part list with `ListParts` before completion.
- Multipart checksum metadata can be composite. The portable full-object
  integrity check is to stream the completed ciphertext through SHA-256 in the
  storage adapter and compare it with the client-declared ciphertext digest
  before accepting completion.

### Expo File Transport

- Expo's upload task provides progress and cancellation, but does not expose a
  durable paused/resumed task. True restart-safe resume must be implemented as
  application-managed multipart state.
- Expo FileSystem supports offset-based bounded reads. The mobile uploader can
  materialize one opaque 5 MiB ciphertext part in cache, upload it through its
  presigned URL, persist the part number and ETag in SQLCipher, and immediately
  delete the part file.
- Signed URLs are ephemeral transport capabilities and must not be persisted in
  SQLCipher, analytics, errors, or logs.

## Selected Protocol

1. The mobile app allocates an immutable UUIDv7 file-object ID while offline.
2. New captures are encrypted once with a random 256-bit DEK, 96-bit GCM nonce,
   and versioned AAD containing the household ID, file-object ID, purpose, and
   format.
3. Before upload, the client computes SHA-256 over the stored ciphertext and
   creates an authorized server upload session with the ciphertext size, safe
   media hint, digest, file-object ID, asset ID, child ID, device ID, AAD
   version, and content nonce/tag metadata required by the accepted file model.
4. The client sends the DEK only in that authenticated create request. The API
   validates authorization and the enrolled device, wraps the DEK immediately
   under the household key, clears the transient buffer, and persists only the
   wrapped key and version metadata.
5. The API initiates provider multipart upload and returns a short-lived signed
   URL for the next required part. It never returns provider credentials.
6. The client uploads bounded ciphertext parts directly, records only part
   number and ETag locally, and reconciles parts with the API after restart or
   ambiguous network failure.
7. Completion is idempotent. The API reconciles provider parts, completes the
   object, streams the resulting ciphertext through SHA-256, and accepts the
   `uploaded` state only when size and digest match. A mismatch is terminal,
   deletes the object, and leaves the local source available for a fresh retry.
8. Cancellation is idempotent, aborts provider multipart state, records a safe
   terminal status, and does not delete the local encrypted source.
9. An authorized download request requires an active enrolled device. The API
   unwraps the DEK transiently and returns it with a short-lived signed GET URL
   over authenticated TLS. The device downloads ciphertext, verifies the
   digest, rewraps the DEK under its local wrapping key, and decrypts only for
   the foreground preview lifecycle.

## State Model

Server upload sessions use:

`created -> uploading -> completing -> uploaded`

with terminal `cancelled`, `expired`, and `failed` states. `uploaded` means the
ciphertext object and full digest were accepted; it does not mean the document
is safe, validated, linked to a record, or ready for OCR. VLT-05 owns those
transitions.

Local upload state uses:

`local_only -> queued -> uploading -> retrying -> uploaded`

with user-visible `failed` and `cancelled` outcomes. Network loss, process
termination, and expired signed URLs are retryable. Authentication,
authorization, digest mismatch, missing local ciphertext, and invalid AAD use
explicit safe error states. No failure deletes the original local ciphertext.

## Database And Worker Consequences

- Reviewed SQL migration `0006_vlt_04_file_upload.sql` should add
  `upload_sessions` and `file_objects` with tenant RLS, append-only audit
  events, idempotency, safe status fields, wrapped-key metadata, and opaque
  storage identifiers.
- `record_file_links` should remain deferred. An uploaded but unvalidated file
  is not a confirmed record attachment.
- The worker must not receive household-key or file-key authority. A narrowly
  scoped database operation should claim expired sessions and return only the
  opaque provider upload identifier needed for abort/cleanup.
- Railway has no lifecycle rule to rescue missed aborts. The worker must retry
  cleanup and keep a safe operational failure state until it succeeds.

## Security And Privacy Constraints

- Synthetic files only; no participant, child, or real medical documents.
- No plaintext filename, path, media bytes, signed URL, bearer token, provider
  credential, DEK, KEK, wrapped-key material, digest, ETag, or storage key in
  logs, analytics, crash reports, or user-visible errors.
- Object keys and part-cache filenames use unrelated opaque IDs.
- Upload availability is false by default and independently controllable as a
  server kill switch.
- The API cannot accept a client-selected household without deriving and
  validating it from the authenticated authority.
- Download denial, revoked membership, revoked session, inactive enrollment,
  cross-household IDs, tampered ciphertext, wrong AAD, and digest mismatch must
  fail closed.
- Worker cleanup operates on ciphertext/provider state only and cannot decrypt.
- Development validation routes and synthetic fixtures must be absent from
  Android, iOS, API, and worker production artifacts.

## Validation Implications

- Automated tests need deterministic fake storage for local Aiven database
  validation. Local Aiven and Railway staging must not be mixed.
- Live provider acceptance must run wholly in Railway staging: staging API,
  worker, PostgreSQL, and the existing documents bucket.
- Physical Android should use the staging HTTPS endpoint, not ADB reverse, for
  real interruption/resume evidence.
- The current preflight found a USB Pixel 8 and a booted iPhone 17 Pro
  Simulator. The repository is now pinned to the globally installed Node
  26.4.0 and pnpm 11.14.0, which must be used for implementation evidence.

## Deferred Questions

- VLT-05 owns magic-byte revalidation, bounded parsing, malware scanning,
  quarantine, previews, and readiness.
- VLT-06 owns OCR and extraction review.
- VLT-07 or later owns linking an accepted file to a confirmed record.
- Production bucket provisioning, production rollout, physical iPhone/Secure
  Enclave proof, a second physical device, target low-end Android, and the full
  assistive-technology matrix remain separate gates.
- Cross-device rewrapping without an API-visible DEK would require a future
  end-to-end key-sharing protocol and is not claimed here.

## Sources

- Tier 1 project sources: implementation roadmap Section 12, architecture
  Sections 15 and 16, backend data model Section 13, mobile application flow
  Sections 12, 14, 15, 17, 18, 20, and 24, ADR-0011, VLT-03 plan/research/code,
  and the current environment catalog.
- Tier 1 provider source: Railway Buckets,
  <https://docs.railway.com/storage-buckets>.
- Tier 1 provider source: Railway storage buckets guide,
  <https://docs.railway.com/guides/storage-buckets-guide>.
- Tier 1 protocol source: Amazon S3 multipart upload overview,
  <https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html>.
- Tier 1 protocol source: Amazon S3 multipart limits,
  <https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html>.
- Tier 1 framework source: Expo SDK 57 FileSystem,
  <https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/>.

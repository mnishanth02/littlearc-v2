# VLT-05-F3 Encrypted Server Previews Implementation Plan

> **Status:** Accepted and implemented within the synthetic local,
> disposable-Aiven, and Railway-staging boundary; staging processing enabled
> under separate founder approval
> **Plan date:** 2026-07-26
> **Last updated:** 2026-07-26
> **Completion date:** 2026-07-26
> **Owner:** Engineering + founder/product
> **Milestone:** M3
> **Parent package:** [`VLT-05`](./vlt-05-worker-side-file-validation-plan.md)
> **Follow-up register:** [VLT-05 closure plan](./vlt-05-follow-up-closure-plan.md)
> **Decision:** [ADR-0016](../../adr/0016-worker-file-validation-and-plaintext-cleanup-boundary.md)
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
> **Evidence:** [implementation evidence](./vlt-05-f3-implementation-evidence.md)

---

## 1. Authorization Boundary

Founder direction on 26 July 2026 accepted this plan and separately authorized
bounded implementation plus synthetic local, disposable-Aiven, and
Railway-staging validation. After reviewing the disabled-flag implementation
evidence, the founder separately authorized staging-only preview enablement and
bounded synthetic enablement validation.

The completed implementation preserves these boundaries:

- `FILE_PREVIEWS_ENABLED=true` only on Railway staging; local defaults and
  production remain false;
- production remains untouched;
- only generated synthetic image and PDF fixtures may be used;
- Gate 2 remains open;
- `VLT-06+`, OCR, record linkage, search, and `VLT-08` UI are not authorized;
- no real child, household, participant, or medical document data may be
  processed; and
- no current VLT-05 completion claim is reopened.

The reviewed migration, disposable Aiven suite, exact worker-image probe,
Railway staging provider probe, repository validation, and separately
authorized enabled-state deployment passed and are recorded in the linked
evidence.

## 2. Outcome

Produce an independently encrypted, metadata-free, bounded JPEG preview from a
validated and malware-clean JPEG, PNG, single-image HEIC, or static PDF
original. Preview failure must never delay, reject, or downgrade the original.

An authenticated active household device may request a short-lived download
grant for the encrypted preview and decrypt it locally. No plaintext preview is
served by the API, stored in PostgreSQL or object storage, or exposed through a
public object URL.

## 3. Scope

- One immutable preview kind and policy version: `validation-preview-v1`.
- JPEG, PNG, and accepted single-image HEIC originals.
- Page 1 only for already accepted static PDFs.
- Maximum output dimension of 1600 pixels without enlargement.
- Final canonical MIME `image/jpeg`.
- Final ciphertext derived from a new random 256-bit DEK, new nonce, and
  derivative-specific AAD.
- Separate preview queue, retry, lease, recovery, and failure state.
- Opaque derivative object keys in the existing private encrypted-document
  bucket.
- Household/device-authorized encrypted preview download grant.
- Reviewed forward PostgreSQL migration `0008_vlt_05_f3_file_previews`.
- Synthetic unit, contract, disposable Aiven, local renderer, worker-image,
  and Railway staging validation.
- Privacy-safe operational state, logs, metrics, and evidence.

## 4. Non-Goals

- Enabling previews in production.
- Real-data, pilot, retention-policy, backup, legal, or incident-response
  approval.
- OCR, PDF text extraction, annotations, links, forms, signatures, or search.
- Rendering rejected, failed, pending, scanner-unavailable, or deleted
  originals.
- Multi-page preview galleries, animation, HEIC sequences, video, DICOM, SVG,
  Office documents, or arbitrary formats.
- Public preview URLs, server-decrypted API responses, browser-direct plaintext,
  staff access, or operations-web display.
- Mobile Vault UI, caching policy, offline preview persistence, or device
  screenshots.
- Replacing the independently encrypted local capture thumbnail.
- Closing `VLT-05-F4`, Gate 2, or any physical-device criterion.

## 5. Confirmed Facts At Plan Acceptance

- `FILE_PREVIEWS_ENABLED=true` currently fails worker configuration.
- The worker configuration type and staging probe require previews to be false.
- `file_objects.preview_state` and the safe status contract contain a
  placeholder state, but there is no derivative table, renderer, object,
  preview queue, or preview download route.
- The accepted worker image originally used Sharp 0.34.5 with a pinned custom
  libvips 8.17.3 build. The required supply-chain remediation now uses Sharp
  0.35.3 and libvips 8.18.3. That minimal build enables HEIF but disables JPEG, PNG, Poppler,
  PDFium, and PPM support.
- QPDF validates the accepted static-PDF policy but does not rasterize pages.
- VLT-04 provides opaque encrypted object storage and short-lived signed
  ciphertext downloads.
- VLT-05 provides authenticated original decryption, cleanup-gated terminal
  state, pg-boss v37, a least-authority worker role, a private current ClamAV
  service, and opaque workspaces.
- The current active client already has a local encrypted thumbnail. A remote
  Vault preview consumer does not yet exist.
- The full authenticated mobile-to-staging lifecycle remains separately blocked
  under `VLT-05-F4`; it is not required for a worker/provider F3 probe.

## 6. Assumptions

- The existing private staging document bucket remains the bounded derivative
  provider; a new bucket or credentials are unnecessary for F3.
- The active device may receive a wrapped/decrypted derivative key through the
  same household/device authorization boundary as the encrypted original.
- One preview per `(source_file_object_id, kind, policy_version)` is sufficient.
- A failed preview falls back to the original file status/icon; it is not a
  validation failure.
- The current Node.js, pnpm, Sharp, libvips, pg-boss, QPDF, PostgreSQL, AWS SDK,
  encryption, and storage versions remain pinned.
- Debian Bookworm security packages remain available at the exact versions
  accepted immediately before implementation.

## 7. Resolved Plan Questions And Deferred Consumer Choice

1. Founder direction moved the bounded server implementation ahead of its
   first `VLT-08` consumer while keeping the consumer itself deferred.
2. The accepted ordered output fallback is
   `(1600 px, quality 82) -> (1280 px, quality 76) -> (960 px, quality 70)`
   with safe preview failure if every result exceeds 1 MiB.
3. Should the first mobile consumer cache decrypted previews only in memory, or
   may a later VLT-08 plan persist them in SQLCipher? This remains a consumer
   plan decision and does not block F3.
4. The reviewed Debian Poppler license, exact package pin, isolated process,
   and maintenance boundary were accepted for this staging implementation.
5. Should future production use a separate derivative bucket? This is not
   needed for synthetic F3 staging acceptance but must be revisited before
   production.

## 8. Architecture Decisions

### 8.1 Separate Preview Lifecycle

Preview derivation uses its own `file-preview-v1` queue and
`file-preview-dead-v1` dead-letter queue. It must not run inline with the
validation terminal commit.

Reasons:

- preview failure cannot block `file_objects.validation_state=ready`;
- renderer outages and retries remain independent from ClamAV and validation;
- a future preview policy version can be regenerated without mutating the
  original;
- preview plaintext cleanup receives an explicit lease and recovery path; and
- disabling previews stops new preview work without disabling validation.

The queue payload contains only `derivativeId`. It contains no source object ID,
household ID, child ID, filename, MIME, object key, URL, or content metadata.

### 8.2 Eligibility And Dispatch

A derivative becomes eligible only when:

- `FILE_PREVIEWS_ENABLED=true`;
- the source is uploaded, not deleted, and `validation_state=ready`;
- `malware_state=clean`;
- the detected MIME is one of the accepted four formats; and
- no row exists for the same source, kind, and policy version.

The worker calls a bounded security-definer candidate function only while the
flag is enabled. That function creates or reuses the derivative row and an
outbox fact transactionally. This bounded sweep handles:

- newly validated originals;
- a crash between validation completion and preview scheduling; and
- synthetic ready originals that existed before staging enablement.

No migration backfill and no unconditional database trigger schedules preview
work while the flag is false.

### 8.3 Exact Renderer Boundary

Keep Sharp and libvips as an exact reviewed pair. The accepted implementation
initially retained 0.34.5/8.17.3; `GHSA-f88m-g3jw-g9cj` requires the bounded
0.35.3/8.18.3 security update:

- pin Sharp 0.35.3 and libvips 8.18.3;
- enable only HEIF, JPEG, and PNG in libvips;
- keep libvips Poppler/PDFium, SVG, WebP, TIFF, GIF, OpenEXR, ImageMagick, and
  other unused loaders disabled;
- add exact Debian Bookworm JPEG/PNG build/runtime packages;
- add exact `poppler-utils` for the standalone `pdftoppm` page-1 renderer;
- retain QPDF as the PDF policy authority; and
- record exact package versions, license files, source checksums, and image
  capability output in `worker-image-dependencies.json`.

At implementation start, re-resolve the exact Bookworm security package
versions from official Debian metadata and fail the image build on drift.
Current research found `poppler-utils 22.12.0-2+deb12u2`,
`libjpeg62-turbo-dev 1:2.1.5-2`, and `libpng-dev 1.6.39-2+deb12u5`; these are
planning inputs, not permission to install or silently substitute versions.

### 8.4 Shared Parser Capacity

Validation and preview subprocesses share one worker-local parser permit. A
worker instance may run at most one QPDF, HEIC, image-preview, or PDF-preview
subprocess at a time. Queue concurrency remains one and no new concurrency
environment variable is introduced in F3.

### 8.5 Output Policy

Every output is:

- one baseline, non-progressive JPEG;
- at most 1600 pixels on its longest edge;
- never enlarged;
- at most 1 MiB plaintext and the same maximum ciphertext payload plus the
  separately stored GCM tag;
- sRGB;
- flattened onto an opaque white background;
- fully decoded after encoding;
- validated by the existing complete JPEG validator; and
- rejected if it contains EXIF, XMP, IPTC, ICC, comment, thumbnail, filename,
  or non-allowlisted application marker content.

Use at most three deterministic attempts:

1. 1600 pixels, quality 82;
2. 1280 pixels, quality 76; and
3. 960 pixels, quality 70.

Stop at the first output at or below 1 MiB. If all attempts exceed the bound,
mark preview generation failed without changing the original.

### 8.6 Image Rendering

For JPEG, PNG, and HEIC:

1. open the authenticated source with strict warning behavior and existing
   pixel/dimension limits;
2. require one image/page and the already accepted format policy;
3. apply orientation before discarding metadata;
4. resize inside the bounded square without enlargement;
5. flatten alpha onto white;
6. convert to sRGB;
7. encode using the deterministic JPEG ladder;
8. fully decode and structurally validate the result; and
9. reject any metadata-bearing or over-limit result.

The child process emits only a minimized JSON success or safe error code.
Native or raw decoder errors, source paths, metadata, and dimensions do not
reach logs.

### 8.7 PDF Rendering

Only an immutable source already accepted by QPDF and marked
`ready`/`clean` may reach the renderer.

Run `pdftoppm` directly without a shell under the same isolated UID and
no-new-privileges boundary. Render only page 1 with fixed arguments equivalent
to:

```text
-f 1 -l 1 -singlefile -scale-to 1600 -cropbox -hide-annotations -jpeg
```

Use a fixed opaque input path and fixed output root. Discard stderr after
mapping exit, signal, timeout, and resource outcomes to safe codes. The
intermediate JPEG is always passed through the Sharp normalization and
post-encode verification pipeline, so no PDF text layer, links, annotations,
attachments, names, or document metadata survive. Visible page pixels remain
sensitive content and must stay encrypted outside the opaque workspace.

QPDF remains the validation authority. Poppler is a renderer only and must not
expand the accepted PDF policy.

### 8.8 Encryption And AAD

Never reuse the original file key, content nonce, or wrapped key.

For each derivative:

- generate a fresh random 32-byte DEK;
- generate a fresh 12-byte AES-GCM content nonce;
- wrap the derivative DEK under the current household key with a fresh wrap
  nonce;
- use the existing 16-byte GCM authentication tag;
- zero all mutable DEK and household-key buffers; and
- use canonical AAD version 1:

```text
protocol=littlearc-file
purpose=validation-preview
sourceObjectId=<immutable source file-object ID>
derivativeId=<immutable derivative ID>
format=image/jpeg
previewPolicyVersion=1
aadSchemaVersion=1
```

Extend the crypto context with a distinct derivative type instead of weakening
the existing `capture-original` union.

### 8.9 Storage And Publication

Add a bounded direct encrypted-object write operation to the provider-neutral
storage interface. It must:

- accept a stream or file path, never a plaintext buffer from an API;
- set provider content type to `application/octet-stream`;
- attach no original metadata, filename, household, child, or document tags;
- write only an opaque candidate key:
  `derivatives/<derivative-id>/<attempt-id>.lac`;
- verify ciphertext byte count and SHA-256 after upload; and
- support idempotent delete.

The object is not ready until its local plaintext workspace is verified absent
and the database commit succeeds. A short-lived signed URL grants access only
to ciphertext. The API never proxies or decrypts preview bytes.

## 9. Data Model And Migration

Create reviewed migration `0008_vlt_05_f3_file_previews`.

### 9.1 `file_derivatives`

Required columns:

- `id` UUIDv7 primary key;
- `household_id` UUIDv7 for RLS and authorization;
- `source_file_object_id` UUIDv7;
- `kind='validation_preview'`;
- `policy_version=1`;
- `state`:
  `pending | queued | rendering | result_pending_cleanup | ready | failed`;
- opaque `storage_key`, nullable until a result is proposed;
- `ciphertext_bytes` and `ciphertext_sha256`;
- `wrapped_file_key`, `wrap_nonce`, `content_nonce`, and `auth_tag`;
- `key_version` and `aad_version=1`;
- `detected_mime='image/jpeg'`;
- bounded `pixel_width` and `pixel_height`;
- `attempt_count`, `attempt_id`, lease expiry, started/completed timestamps;
- nullable allowlisted `safe_error_code`;
- `created_at`, `updated_at`, and nullable `deleted_at`.

Constraints:

- unique `(source_file_object_id, kind, policy_version)`;
- composite tenant FK `(household_id, source_file_object_id)`;
- derivative/object-key uniqueness;
- exact key/nonce/tag/hash/size/dimension bounds;
- no child ID or filename column; and
- forced household RLS with default-deny behavior.

`file_objects.preview_state` remains the safe projection:

```text
not_authorized -> pending -> processing -> ready
                                  \------> failed
```

The detailed derivative state remains worker-internal.

### 9.2 Outbox And Least-Authority Functions

Add minimized preview outbox state and security-definer functions for:

- ensuring bounded eligible candidates;
- claiming/finishing preview outbox facts;
- claiming and heartbeating one derivative lease;
- proposing encrypted derivative metadata;
- committing ready only after cleanup;
- retrying safe failures;
- listing/recovering stale attempts;
- marking retry exhaustion; and
- reading an authorized derivative download grant.

Every function sets a fixed `search_path`, validates state/attempt ownership,
and returns only minimum fields. Revoke direct worker access to
`file_derivatives`, preview outbox rows, tenant tables, and original validation
tables. The worker receives execute permission only on its preview functions.

The API remains `littlearc_app`, sets the existing household/identity/device
context, and is subject to forced RLS.

## 10. Queue, Retry, And Idempotency

Queue definition:

| Setting | Value |
| --- | --- |
| Queue | `file-preview-v1` |
| Dead letter | `file-preview-dead-v1` |
| Payload | `{ derivativeId }` only |
| Deterministic job ID | derivative ID |
| Singleton key | derivative ID |
| Expiry | 15 minutes |
| Heartbeat | 60 seconds; refresh every 30 seconds |
| Retries | 5 |
| Backoff | 30 seconds exponential, maximum 15 minutes |
| Retention | 7 days |
| Local concurrency | 1 plus shared parser permit |

Duplicate candidate sweeps, outbox delivery, and jobs converge on the unique
derivative row and lease. A retry never creates a second active derivative.

Candidate storage keys include the attempt ID. Recovery deletes any candidate
for the expired attempt before clearing its proposed state and requeueing.
Provider delete failure is retryable and prevents recovery completion.

## 11. Failure And State Matrix

| Condition | Preview action | Original action |
| --- | --- | --- |
| Flag false | Do not schedule; `not_authorized` | None |
| Source not ready/clean | Do not schedule | None |
| Duplicate dispatch/job | Reuse row/job; no concurrent render | None |
| Renderer unavailable | Retry, then preview `failed` | Remains `ready` |
| Malformed renderer output | Preview `failed` with safe code | Remains `ready` |
| Timeout/resource limit | Retry if operational, then `failed` | Remains `ready` |
| Output over 1 MiB | Preview `failed` | Remains `ready` |
| Encryption/key error | Retry; no upload | Remains `ready` |
| Upload/hash mismatch | Delete candidate and retry | Remains `ready` |
| Workspace cleanup failure | `result_pending_cleanup`; retry cleanup | Remains `ready` |
| Cancellation/shutdown | Abort, delete candidate, clean, requeue | Remains `ready` |
| Crash/SIGKILL | Lease recovery, candidate/workspace cleanup, requeue | Remains `ready` |
| Retry exhausted | Cleanup first, then preview `failed` | Remains `ready` |
| Source soft-deleted | No grant; schedule encrypted derivative deletion | Preserve source policy |

## 12. Plaintext Cleanup Strategy

Extend the opaque workspace with fixed names only:

```text
<tmp-root>/<opaque-attempt-id>/
  ciphertext.part
  input.part
  input.bin
  render-intermediate.bin
  preview-plaintext.part
  preview-ciphertext.part
```

No extension, original filename, MIME, source ID, derivative ID, household ID,
child ID, or title appears in a local path.

### Success

1. Close renderer, image, scanner, encryption, storage, and file handles.
2. Zero derivative DEK, household key, and mutable pixel buffers.
3. Propose encrypted metadata as nonterminal.
4. Remove and verify the entire workspace.
5. Commit derivative `ready` and source projection `preview_state=ready`.
6. Acknowledge the job.

### Failure Or Cancellation

Abort subprocess and stream trees, delete any uploaded candidate, zero keys and
buffers, remove and verify the workspace, then retry or commit `failed`.
Cleanup failure is always retryable and prevents terminal preview state.

### Crash Or Host Replacement

Startup and periodic recovery must:

1. stop new preview intake if the temp root cannot be inspected;
2. find expired preview leases;
3. remove the opaque attempt workspace;
4. delete the attempt-derived provider candidate;
5. verify both are absent;
6. reset the derivative to `queued`; and
7. recreate or confirm the deterministic job.

## 13. API And Contract

Add:

```text
GET /v1/files/{fileObjectId}/preview
```

Requirements:

- authenticated consumer session;
- valid `x-littlearc-device-id`;
- active, non-revoked device enrollment;
- current same-household authorization;
- non-deleted source and ready derivative;
- RLS/BOLA-safe not-found behavior;
- `cache-control: no-store, private`;
- five-minute signed `GET` URL;
- response contains ciphertext facts and the locally decryptable derivative
  key, never plaintext preview bytes; and
- audit the authorized grant without URL, key, object path, filename, child
  data, or content.

Proposed strict response:

```text
fileObjectId
derivativeId
previewPolicyVersion=1
declaredMime=image/jpeg
ciphertextBytes
ciphertextSha256
aadVersion=1
contentNonce
authTag
encodedFileKey
method=GET
url
expiresAt
```

Pending, processing, failed, deleted, and unauthorized cases return generic
safe errors. The existing status route continues to expose only
`previewState`; it does not expose renderer or retry details.

## 14. Observability And Privacy

Allowed aggregate events:

- preview dispatch success/failure;
- preview started/completed/retrying/failed;
- preview recovery/scavenging;
- renderer capability unavailable;
- candidate cleanup failed; and
- aggregate duration, queue age, retry, output-size bucket, worker RSS, and
  temp-space bucket.

Never log or send to analytics/error monitoring:

- source or derivative IDs;
- household, child, user, device, record, or participant IDs;
- filename, MIME from the source, object key, URL, temp path, or bucket;
- image dimensions tied to a job;
- PDF text, page content, metadata, annotations, or links;
- renderer stderr/stdout or native exception text;
- ciphertext/plaintext hash, key, nonce, tag, or AAD; or
- plaintext/ciphertext preview bytes.

Add positive canaries for original filename, household/child IDs, visible
synthetic text, temp paths, AAD, signed URL fragments, and key material. Canary
tests must prove absence from logs, pg-boss rows, operational database fields,
probe output, and evidence.

## 15. Security Controls

- Render only authenticated immutable originals already `ready` and
  malware-clean.
- Reverify provider ciphertext byte count, SHA-256, AES-GCM tag, and AAD before
  rendering.
- Use direct executables with fixed arguments and no shell.
- Apply `setpriv --no-new-privs`, `prlimit`, isolated UID, bounded CPU/wall
  time, address space, V8 heap, output file, descriptors, processes, allocator
  arenas, native threads, and shared concurrency.
- Keep the worker image without browser, JavaScript-in-PDF, ImageMagick, SVG,
  Office, OCR, or network-fetch renderers.
- Deny public bucket access and serve ciphertext only through a short-lived
  authorized grant.
- Validate and fully decode the final JPEG after rewriting.
- Require current ClamAV readiness and scan the final plaintext derivative;
  scanner unavailability retries preview only.
- Do not claim "virus-free"; the product state remains `preview ready`.
- Review Poppler, libjpeg, libpng, Sharp, and libvips licenses/advisories before
  pin adoption.

## 16. Affected Files And Modules

Expected implementation files:

### Domain And Contracts

- `packages/domain/src/file-validation.ts`
- `packages/domain/src/file-validation.test.ts`
- `packages/domain/src/index.ts`
- `packages/contracts/src/schema-source/files.ts`
- `packages/contracts/src/schema-source/files.test.ts`
- generated OpenAPI artifacts and client types

### Crypto And Storage

- `packages/crypto/src/file-key.ts`
- `packages/crypto/src/file-key.test.ts`
- `packages/crypto/src/file-content.ts` only if a bounded reusable helper is
  required
- `packages/storage/src/storage.ts`
- `packages/storage/src/s3.ts`
- `packages/storage/src/memory.ts`
- `packages/storage/src/storage.test.ts`

### Database

- `packages/database/src/schema/file-derivatives.ts`
- `packages/database/src/schema/file-objects.ts`
- `packages/database/src/schema/index.ts`
- `packages/database/src/file-preview.ts`
- `packages/database/src/file-preview.test.ts`
- `packages/database/src/migrations/vlt-05-f3-file-previews.ts`
- `packages/database/src/migrations/metadata.ts`
- `packages/database/src/migrations/migration.test.ts`
- generated `packages/database/migrations/0008_vlt_05_f3_file_previews.sql`

### Worker

- `apps/worker/src/config.ts`
- `apps/worker/src/runtime.test.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/file-preview/renderer.ts`
- `apps/worker/src/file-preview/renderer-child.ts`
- `apps/worker/src/file-preview/renderer.test.ts`
- `apps/worker/src/file-preview/handler.ts`
- `apps/worker/src/file-preview/handler.test.ts`
- `apps/worker/src/queue/file-preview-queue.ts`
- `apps/worker/src/queue/file-preview-queue.test.ts`
- `apps/worker/src/staging-probe.ts`
- optional synthetic `apps/worker/src/integration/file-preview.ts`
- `apps/worker/package.json`

### API

- `apps/api/src/file-upload.ts`
- `apps/api/src/file-upload-route.ts`
- `apps/api/src/file-upload.test.ts`
- `apps/api/src/server.test.ts`
- `apps/api/integration/off-02-household.ts` or a focused preview integration
  entry point

### Infrastructure, Tooling, And Documentation

- `infra/railway/staging/worker/Dockerfile`
- `infra/railway/staging/worker-image-dependencies.json`
- `infra/railway/staging/worker.railway.json` only if watch paths change
- `infra/railway/staging/variables.manifest.json`
- `tooling/railway/policy.mjs`
- root and worker package scripts/lockfile
- ADR-0016, testing/environment references, context indexes, status, plan, and
  a new F3 evidence file after validation

No mobile production source is required for worker/API F3 validation.

## 17. Testing Strategy

### Unit

- flag remains false by default and fails closed before authorization;
- image orientation, alpha flattening, resize ladder, no enlargement, and size
  cap;
- JPEG/PNG/HEIC single-image handling;
- PDF page 1 only and fixed renderer arguments;
- final full decode, JPEG structure, and metadata-marker absence;
- resource, timeout, crash, cancellation, and raw-error minimization;
- fresh DEK/nonce/AAD separation from the original;
- provider write/hash/delete and opaque derivative key policy;
- queue payload minimization, deterministic job, retry, DLQ, and drift checks;
- duplicate eligibility/dispatch/job/claim idempotency;
- cleanup before ready/failed across all paths;
- original remains ready on every preview failure;
- safe logging and positive leakage canaries; and
- API authorization, not-found/BOLA, no-store, and strict response contracts.

### Disposable Aiven

Using two generated synthetic households and generated ciphertext metadata:

- apply migrations 0001-0008 and reviewed pg-boss v37 plan;
- prepare the preview queues through migration credentials;
- prove ready/clean-only eligibility;
- prove atomic candidate/outbox creation and duplicate convergence;
- prove worker direct-table denial and minimum function returns;
- prove lease, heartbeat, proposal, cleanup-gated commit, retry exhaustion, and
  stale recovery;
- prove RLS and cross-household preview-grant denial;
- prove source deletion blocks grants and schedules cleanup;
- prove preview failure cannot mutate original readiness;
- prove no plaintext/log/queue canaries; and
- remove the disposable database.

### Local Renderer Integration

Generate all fixtures at runtime:

- high-entropy JPEG;
- transparent PNG with metadata canaries;
- accepted single-image HEIC;
- static one-page and multi-page PDFs with visible synthetic text, metadata,
  links, and annotations;
- active/rejected PDF control;
- malformed/truncated inputs;
- oversized/noisy output case;
- timeout, crash, cancellation, and cleanup cases.

Verify output dimensions, byte cap, JPEG decode, metadata absence, encryption,
authenticated decryption, scanner clean result, and complete temp cleanup.

### Railway Staging

Before enablement, the worker predeploy probe with
`FILE_PREVIEWS_ENABLED=false` must:

- verify exact Sharp/libvips/JPEG/PNG/HEIF/Poppler/QPDF versions;
- render generated JPEG, PNG, HEIC, and static PDF fixtures;
- prove PDF page 1 only and hidden annotations;
- prove deterministic resize/quality bounds;
- verify metadata/canary removal and complete JPEG decode;
- encrypt, upload, hash, download, authenticate, and delete one opaque
  synthetic derivative candidate;
- prove private storage, current ClamAV scan, and preview workspace cleanup;
- emit only one generic pass summary; and
- start the worker with previews still disabled.

After all local, Aiven, repository, and staging evidence is reviewed, a
separately recorded final staging step may set `FILE_PREVIEWS_ENABLED=true`
and must rerun the same mandatory probe in the enabled configuration. Both
disabled and enabled probes passed. Production remains false and untouched.

## 18. Validation Commands

Expected commands after implementation authorization:

```sh
pnpm --filter @littlearc/domain test
pnpm --filter @littlearc/crypto test
pnpm --filter @littlearc/storage test
pnpm --filter @littlearc/database test
pnpm --filter @littlearc/worker test
pnpm --filter @littlearc/api test
pnpm test:integration:file-preview
pnpm test:database:file-preview
pnpm test:database:rls
pnpm test:contract
pnpm test:unit
pnpm check:generated
pnpm check:railway
pnpm check:supply-chain
pnpm check:format
pnpm check:docs
pnpm typecheck
pnpm build
pnpm validate
./tooling/validate-clean-checkout.sh
git diff --check
```

Run the Aiven commands only through the ignored `.env.aiven` workflow. Do not
use `db:push`. Do not place staging or production credentials in commands,
logs, plans, or evidence.

## 19. Android And iOS Implications

### Worker/API F3

- No Android or iOS source change is required.
- No native build, device, accessibility, physical-iOS, background-transfer, or
  two-device evidence is claimed.
- Generated clients will gain the encrypted preview grant contract.

### Future VLT-08 Consumer

A separately reviewed mobile plan must:

- request the grant only for an active household/device;
- download ciphertext and authenticate/decrypt locally;
- keep the derivative key and plaintext out of logs and analytics;
- define protected-memory and SQLCipher cache behavior;
- clear decrypted previews on sign-out, enrollment loss, deletion, and cache
  eviction;
- provide accessible loading/failed/fallback UI; and
- run the applicable Android/iOS/device matrix.

## 20. Migration And Manual Steps

1. Review the SQL source and generated checksum artifact.
2. Review exact Debian package versions, licenses, and advisories.
3. Apply migration 0008 and prepare queues to a disposable Aiven database.
4. Run the complete synthetic Aiven suite and destroy the database.
5. Apply migration 0008 to Railway staging with migration credentials.
6. Deploy the exact worker image with previews false.
7. Run the worker predeploy capability/provider probe.
8. Deploy the API contract/route and verify health without a staging auth
   bypass.
9. Review evidence and confirm all cleanup/provider candidates are absent.
10. Only then record direction to set the staging flag true.

No production migration, service, variable, bucket, or deployment is allowed.

## 21. Rollback

- Set `FILE_PREVIEWS_ENABLED=false`; validation remains enabled.
- Stop preview candidate creation and dispatch.
- Allow active preview jobs to abort through normal cleanup or drain the queue.
- Delete uncommitted candidate objects after lease ownership is resolved.
- Keep ready encrypted derivatives readable only if policy remains accepted;
  otherwise disable grants and schedule bounded encrypted-object deletion.
- Roll back the worker/API deployment to the prior exact image/version.
- Do not reverse migration 0008 automatically. Use a reviewed forward fix.
- Do not delete the original encrypted object or change original validation
  state during preview rollback.

## 22. Risks And Blockers

| Risk or blocker | Control or resolution |
| --- | --- |
| Plan is not implementation authorization | Require explicit founder acceptance and bounded implementation direction |
| No current remote Vault consumer | Keep F3 optional or move it earlier only by explicit product direction |
| Poppler expands parser and license surface | Exact Bookworm pin, license/advisory review, standalone sandbox, page-1-only arguments |
| JPEG/PNG expands custom libvips surface | Enable only required loaders/encoder and verify exact capability at build/predeploy |
| Preview is still sensitive document content | Encrypt with a fresh DEK before storage; ciphertext-only API/provider |
| Renderer exploit or resource exhaustion | Ready/clean source, no-new-privileges, fixed arguments, process/resource/concurrency bounds |
| Metadata or embedded content survives | Rasterize, normalize, rewrite, full-decode, marker-level metadata verification |
| Crash leaves plaintext or provider candidates | Attempt-derived keys, lease recovery, workspace and provider cleanup before terminal state |
| Preview failure affects trusted original | Independent row/queue/state; original remains ready |
| Existing ready files miss scheduling | Bounded idempotent eligibility sweep only while flag is true |
| Authenticated staging end-to-end remains unavailable | Treat F4 separately; use direct synthetic provider probe without auth bypass |
| Production/real-data assumptions leak into staging | Production absent/untouched, synthetic fixtures and canaries only |

## 23. Ordered Implementation Steps

Each step must be independently reviewable and verified before continuing.

1. Accept this plan and record bounded implementation authorization.
2. Add domain preview constants, limits, safe codes, and tests.
3. Extend derivative crypto AAD/key wrapping without changing original AAD.
4. Add opaque derivative storage write/delete/hash behavior and tests.
5. Add migration 0008, schema, least-authority functions, RLS, generated
   artifact, and database unit tests.
6. Add the disposable Aiven preview lifecycle suite and pass it before staging.
7. Extend the exact worker image and supply-chain policy with the reviewed
   JPEG/PNG/Poppler pins.
8. Add the sandboxed image/PDF renderer and focused hostile/metadata tests.
9. Add the cleanup-gated preview handler and provider candidate recovery.
10. Add the minimized pg-boss preview queue, dispatch, DLQ, and recovery.
11. Add the authorized encrypted preview download contract and API route.
12. Integrate runtime configuration while preserving false-default and
    production rejection.
13. Add local end-to-end synthetic renderer/encryption/cleanup validation.
14. Run root validation and clean-checkout proof.
15. Apply the reviewed migration to Railway staging.
16. Deploy worker/API with previews false and pass the exact staging probe.
17. Record implementation evidence and update ADR/status documentation.
18. Review evidence, then separately authorize and set the staging flag true.

## 24. Acceptance Criteria

F3 is complete only when:

1. The plan and implementation are separately authorized.
2. `FILE_PREVIEWS_ENABLED` remains false until every prerequisite passes.
3. Only ready, malware-clean, non-deleted originals become eligible.
4. JPEG, PNG, HEIC, and static PDF page 1 produce a fully decoded canonical
   JPEG within the dimension and byte bounds.
5. Output contains no metadata, comments, embedded thumbnails, links,
   annotations, PDF text layer, filename, or non-allowlisted application data.
6. Image/PDF rendering runs under the reviewed exact image, fixed arguments,
   isolated UID, no-new-privileges, resource limits, and shared concurrency.
7. The derivative uses a fresh DEK, nonce, wrap nonce, derivative AAD, and
   ciphertext hash; original key material is never reused.
8. Object storage contains only opaque encrypted derivatives and no public or
   plaintext object.
9. Duplicate sweeps, dispatches, jobs, retries, restarts, and crashes converge
   on one derivative per source/kind/version.
10. No preview terminal state is committed before local plaintext and failed
    candidate cleanup are verified.
11. Every preview failure leaves the original `ready`.
12. Worker access remains function-only; API access remains household/device
    authorized and RLS/BOLA-safe.
13. The preview grant is ciphertext-only, five minutes, no-store/private, and
    unavailable for pending/failed/deleted/unauthorized objects.
14. Logs, jobs, state, probes, and evidence contain no IDs, filenames, content,
    paths, URLs, keys, AAD, plaintext, or canaries.
15. Disposable Aiven, local integration, Railway staging probe, repository,
    supply-chain, generated-output, and clean-checkout validation pass.
16. Preview staging enablement is recorded only after evidence review.
17. Production remains untouched, real data remains prohibited, Gate 2 remains
    open, and F4/VLT-06+ remain unauthorized.

## 25. Sources

- Tier 1: [NIST SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final)
  defines AES-GCM authenticated encryption with associated data. LittleArc
  continues its accepted fresh-key/fresh-nonce AES-256-GCM boundary.
- Tier 1: [PostgreSQL row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
  documents forced/default-deny tenant policies used by the existing database
  pattern.
- Tier 4 official project:
  [Sharp output](https://sharp.pixelplumbing.com/api-output/) documents
  metadata stripping by default and JPEG output; F3 verifies the result rather
  than trusting the default alone.
- Tier 4 official project:
  [Sharp resize](https://sharp.pixelplumbing.com/api-resize/) documents
  inside-fit and no-enlargement behavior.
- Tier 4 official project:
  [Sharp custom libvips installation](https://sharp.pixelplumbing.com/install/)
  supports the existing pinned global-libvips build model.
- Tier 4 distribution:
  [Debian `pdftoppm` manual](https://manpages.debian.org/bookworm/poppler-utils/pdftoppm.1.en.html)
  documents page-range, single-file, scaling, and JPEG rendering arguments.
- Tier 4 distribution:
  [Debian `poppler-utils`](https://packages.debian.org/bookworm/poppler-utils),
  [libjpeg](https://packages.debian.org/bookworm/libjpeg62-turbo-dev), and
  [libpng](https://packages.debian.org/bookworm/libpng-dev) provide the
  Bookworm package/version inputs that must be reverified before adoption.
- Tier 2 industry guidance:
  [AWS S3 presigned URL guidance](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
  supports action-scoped, expiring ciphertext grants.
- Security guidance:
  [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
  recommends defense in depth, image rewriting, randomized names, storage
  isolation, authorization, malware scanning, and size limits.

## 26. Implementation-Ready Context Summary

### Decisions

- Separate `file-preview-v1` queue and derivative lifecycle.
- Ready/clean originals only; preview failure never changes original readiness.
- Existing Sharp/libvips pins retained; enable only JPEG/PNG and add standalone
  exact Poppler rendering.
- Static PDF page 1 only; every format normalizes to bounded metadata-free JPEG.
- Fresh derivative DEK/nonce/AAD and ciphertext-only private storage/API.
- Cleanup-gated terminal state and attempt-derived provider candidate keys.

### Constraints

- Implementation and staging-only enablement are authorized and complete.
- `FILE_PREVIEWS_ENABLED=true` only in Railway staging after the reviewed
  implementation, Aiven, staging, repository, and evidence checks passed.
- Synthetic data only; production untouched; Gate 2 open.
- No OCR, VLT-08 UI, F4 lifecycle, real data, or `VLT-06+`.

### Files To Edit

- Domain/contracts preview limits and grant schemas.
- Crypto derivative AAD/key context.
- Storage direct encrypted write and derivative key policy.
- Database schema, migration 0008, preview persistence/functions, and tests.
- Worker renderer, handler, queue, runtime, tests, image, and staging probe.
- API preview service/route/tests.
- Railway exact dependency manifest/policy and focused documentation/evidence.

### Commands To Run

```sh
pnpm test:integration:file-preview
pnpm test:database:file-preview
pnpm test:database:rls
pnpm test:contract
pnpm test:unit
pnpm check:generated
pnpm check:railway
pnpm check:supply-chain
pnpm check:format
pnpm check:docs
pnpm typecheck
pnpm build
pnpm validate
./tooling/validate-clean-checkout.sh
git diff --check
```

### Acceptance Criteria

- Bounded metadata-free JPEG from accepted image formats and static PDF page 1.
- Fresh authenticated encryption and opaque ciphertext-only provider storage.
- Idempotent queue/state, least authority, authorized grant, and cleanup before
  ready/failed.
- Original remains ready on all preview failures.
- Synthetic Aiven/local/Railway and repository evidence passes before staging
  flag enablement.

### Known Risks And Blockers

- Separate implementation authorization is still required.
- No current remote Vault consumer.
- Poppler license/advisory and exact package review is required.
- F4 full mobile-to-staging evidence remains separately blocked.
- Production, real-data, and Gate 2 gates remain unchanged.

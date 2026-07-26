# VLT-05 Implementation Evidence

> **Status:** Complete within the recorded synthetic local-Aiven and Railway-staging boundaries
> **Evidence date:** 2026-07-25
> **Last updated:** 2026-07-26
> **Owner:** Engineering
> **Milestone:** M3
> **Plan:** [VLT-05 plan](./vlt-05-worker-side-file-validation-plan.md)
> **Decision:** [ADR-0016](../../adr/0016-worker-file-validation-and-plaintext-cleanup-boundary.md)
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)

---

## Outcome

VLT-05 is implemented within the evidence boundary below. VLT-04 completion
now atomically emits one minimized validation request. A least-authority worker
can idempotently claim the opaque file-object ID, verify and decrypt the
ciphertext, apply bounded structure/PDF rules, require a current clean malware
scan, remove its opaque plaintext workspace, and only then commit a safe
terminal state.

The queue payload contains only `fileObjectId`. Worker PostgreSQL connections
force `role=littlearc_worker`; direct validation-table access is revoked.
Operational logs and the household-authorized status response contain stable
states/codes without filename, object key, document content, child data, or
household identifier.

The separately authorized `VLT-05-F3` follow-up later added and enabled in
staging the encrypted-preview implementation recorded in
[its evidence](./vlt-05-f3-implementation-evidence.md).
`FILE_PREVIEWS_ENABLED=true` only in staging. Production has no service
instances and was not changed. Gate 2 remains open.

## Implemented Boundary

- Reviewed migration `0007_vlt_05_file_validation` with explicit state,
  attempt, scanner, cleanup, audit, RLS, safe-status, claim/propose/commit,
  retry-exhaustion, recovery, and least-authority grants.
- Reviewed reproducible pg-boss v37 schema plan, migration-only queue
  preparation, deterministic job IDs, bounded retries/backoff, dead-letter
  queue, retry exhaustion reconciliation, graceful shutdown, and lease
  heartbeat.
- Streaming storage read plus AES-256-GCM authenticated file decrypt with
  ciphertext size/SHA-256 recheck, AAD/tag verification before parsing, and
  transient-key clearing.
- Complete bounded JPEG marker, PNG chunk/CRC/decompression, and HEIC/HEIF
  validation. HEIC/HEIF requires the expected bounded top-level ISO-BMFF
  structure and a complete single-primary-image pixel decode in the isolated
  worker subprocess.
- Verified QPDF 12.3.2 Linux x64 artifact with an immutable checksum and
  no-shell `setpriv`/`prlimit` execution. Static, unencrypted PDFs only;
  encrypted, malformed, active, embedded, form/XFA, JavaScript, rich-media,
  over-page, over-object, timeout, and resource-limit cases reject safely.
- Provider-neutral clamd `INSTREAM` adapter with byte/time limits and
  fail-closed readiness.
- Digest-pinned private staging ClamAV service with bounded clamd configuration,
  one-shot FreshClam before startup, continuous FreshClam, minimum loaded
  signature serial, and recency attestation.
- Opaque mode-0700 workspaces, atomic `.part` promotion, cleanup verification
  before terminal commit, cleanup retry, cancellation handling, startup
  scavenging, and periodic stale-workspace recovery.
- Household-authorized safe API status plus allowlisted worker lifecycle and
  validation outcomes.

## Automated And Database Evidence

The following checks passed with Node.js 26.4.0 and pnpm 11.14.0:

```sh
pnpm --filter @littlearc/worker test
pnpm --filter @littlearc/worker typecheck
pnpm test:integration:heic
pnpm test:database:file-validation
pnpm test:database:rls
pnpm test:contract
pnpm test:unit
pnpm typecheck
pnpm check:workspace
pnpm check:environment
pnpm check:railway
pnpm check:format
pnpm check:docs
pnpm check:supply-chain
pnpm build
pnpm validate
./tooling/validate-clean-checkout.sh
git diff --check
```

Focused results:

| Surface | Result |
| --- | --- |
| Worker | 7 files and 38 tests passed: configuration/role, queue handler, JPEG/PNG/HEIC/PDF structure, scanner, cancellation, and workspace recovery |
| API | 3 files and 24 tests passed, including safe file status and minimized dispatch |
| Domain | 7 files and 34 tests passed, including validation transitions and limits |
| Database | 3 files and 31 tests passed, including migration checksum/grants |
| Crypto | 3 files and 7 tests passed, including streamed authenticated file decrypt |
| Observability | 5 files and 17 tests passed, including validation log allowlists/canaries |
| Contracts | 2 files and 15 tests passed |
| Disposable Aiven | Migrations 0001-0007 and pg-boss v37 prepared; atomic minimized dispatch, worker DDL denial/direct-read denial, minimum claim, cleanup-gated commit, RLS/BOLA, retry exhaustion, and plaintext canaries passed |
| Gate 1 RLS regression | PostgreSQL 17.10 no-context, cross-household visibility/update/insert denial passed |

The disposable Aiven suite uses generated identifiers and ciphertext metadata
only. It creates and removes its database.

## Local ClamAV Follow-Up

The accepted local-provider follow-up passed on 26 July 2026 through
`pnpm test:integration:clamav`:

- official Homebrew ClamAV 1.5.3 was installed as a developer-machine tool;
- a task-scoped configuration and freshly downloaded signature directory were
  created under the platform temp root;
- loopback-only clamd was started without enabling a persistent service;
- the production `INSTREAM` adapter passed readiness, generated benign,
  runtime-generated EICAR detection, client-side oversize, and stopped-daemon
  unavailable mapping;
- output contained only the generic pass summary; and
- clamd stopped and the temporary configuration, signatures, and plaintext
  workspace were removed.

This closes local real-ClamAV adapter evidence independently from the already
accepted private Railway staging evidence. Docker remains unnecessary for this
check. See the
[follow-up closure plan](./vlt-05-follow-up-closure-plan.md).

## Bounded HEIC Follow-Up

The separately authorized `VLT-05-F2` follow-up passed on 26 July 2026.

- The worker image pins Node.js 26.4.0 by image digest, Sharp 0.35.3,
  libvips 8.18.3 by source checksum, and the exact Debian 12 codec packages
  libheif 1.15.1-1+deb12u1, libde265 1.0.11-1+deb12u2, and
  x265 3.5-2+b1.
- The 26 July supply-chain remediation replaced the original Sharp
  0.34.5/libvips 8.17.3 pair because `GHSA-f88m-g3jw-g9cj` marks Sharp versions
  before 0.35.0 vulnerable. The source-built synthetic HEIC and preview
  integration checks pass with the replacement pair.
- The minimal libvips build enables HEIF as its only external image format.
  Sharp is rebuilt against that global libvips, and the image build verifies
  the resulting capability before it can deploy.
- Validation requires the expected bounded `ftyp`, `meta`, and `mdat`
  top-level boxes, rejects AVIF, sequence brands, extra top-level boxes, and
  trailing data, and then performs a complete raw-pixel decode. The decoded
  result must be one HEVC-compressed primary image with an allowed depth,
  channel count, dimensions, and pixel count.
- Untrusted decoding runs without a shell under `setpriv --no-new-privs` and
  `prlimit`, as the isolated UID 55105. It has a 30-second CPU and wall-clock
  limit, 256 MiB old-space and 16 MiB semi-space Node.js limits, a 4 GiB
  virtual-address ceiling, a 16 MiB output-file ceiling, and descriptor and
  process limits of 64. Native concurrency and allocator arenas are bounded.
- `pnpm test:integration:heic` independently generates synthetic HEIC images
  with libvips and `heif-enc`, proves full decode, and proves safe rejection of
  sequence, AVIF, truncated, and trailing-box cases plus cancellation and
  temporary-workspace cleanup.
- The custom staging image generates a synthetic 2-by-2 HEIC fixture using its
  exact codec stack. The predeploy probe copies it into an opaque workspace,
  executes the production sandboxed full decoder, and verifies cleanup.

## Railway Staging Evidence

Only `staging` was changed. Production remains empty and untouched.

- Migration `0007_vlt_05_file_validation` and the reviewed pg-boss v37 schema
  plan were applied with migration credentials.
- The final API deployment with safe status contracts is
  `0ece4649-d201-4750-859f-80a4bd016120`.
- The private ClamAV service has no public domain. Deployment
  `13e3de7a-3881-4e4f-aede-93da3ac1c3ec` loaded signature serial `28072` only
  after FreshClam completed and reported the configured 27 MiB stream/file/scan
  bounds, recursion limit 8, and two scan threads.
- The bounded-HEIC worker deployment is
  `6b455ef2-bef9-4dc6-8780-4ec064eb4455`; Railway reported image digest
  `sha256:22c060686f451215e0427ca86088ef1e5048970e638786958ece2c1fd3ed116a`.
  Its predeploy probe printed:
  `VLT-05 staging probe passed: exact bounded HEIC decoder, full synthetic
  decode, QPDF sandbox, fresh private scanner, clean/detected matrix, previews
  off, and workspace cleanup.`
- The probe generated its benign bytes and EICAR string at runtime, verified
  scanner readiness/current signature attestation, produced clean and detected
  outcomes, executed the exact HEIC and QPDF sandboxes, removed its opaque
  workspace, and then started the worker. The steady service used approximately
  136 MiB after startup, with an observed maximum of approximately 142 MiB.

## Security And Privacy Evidence

- Queue facts exclude household/child IDs, filename, MIME, object key, digest,
  URLs, key material, and document metadata.
- Worker logs accept only stable codes, outcome, safe error code, aggregate
  duration/retry/queue-age buckets, environment, service, version, and
  timestamp.
- Database operational state stores detected MIME, page count, scanner engine
  version/signature serial, timestamps, attempt count, and safe error code; it
  stores no filename or content.
- Worker-table access is denied and claim functions return no child ID,
  filename, record/membership facts, or household identifier.
- No real child, household, participant, or medical document data was used.
- No filename, document content, child data, household identifier, or plaintext
  canary was written to logs or evidence.

## Mobile Implications

No Android or iOS production source changed. Existing clients can observe the
expanded safe validation state through the file-status contract when a future
mobile package consumes it. No native build, device, physical-iOS,
accessibility, background-transfer, or two-device claim is made by this
worker-only package.

## Evidence Boundary And Deferred Work

This evidence does not:

- close Gate 2 or authorize `VLT-06+`;
- authorize real data, production, pilot distribution, or a production
  malware-scanner/retention/incident policy;
- authorize preview processing, a mobile preview consumer, OCR, extraction,
  record linkage, search, or automatic rendering of rejected originals;
- prove a full authenticated mobile-upload-to-staging-worker lifecycle; staging
  proves the deployed parser/scanner/cleanup/runtime boundary while disposable
  Aiven proves the full database lifecycle separately;
- claim support for HEIC variants outside the exact accepted single-primary
  image policy or treat HEIC as an authorized `VLT-06` OCR source;
- prove physical Android/iOS, two-device, low-end Android, or full
  assistive-technology behavior; or
- accept signed/form PDFs, content disarm/reconstruction, or novel-malware
  detection guarantees.

The ClamAV signature observation is an operational attestation and expires
after 72 hours. Staging intake fails closed until the observed timestamp and
minimum serial are refreshed from FreshClam evidence.

## Rollback

Set `FILE_VALIDATION_ENABLED=false`, keep
`FILE_VALIDATION_STAGING_PROBE=false`, drain the worker, and redeploy the last
known-good worker if validation must be paused. Pending/queued objects remain
non-ready. Do not reverse migration `0007` automatically; use a reviewed
forward compatibility fix. Remove the private synthetic ClamAV service only
after validation is disabled and no leased workspace remains.

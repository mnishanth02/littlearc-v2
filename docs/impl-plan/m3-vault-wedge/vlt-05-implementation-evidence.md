# VLT-05 Implementation Evidence

> **Status:** Complete within the recorded synthetic local-Aiven and Railway-staging boundaries
> **Evidence date:** 2026-07-25
> **Last updated:** 2026-07-25
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

`FILE_PREVIEWS_ENABLED=false`. No preview dependency, renderer, derivative
table, derivative object, preview route, or preview plaintext was introduced.
Production has no service instances and was not changed. Gate 2 remains open.

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
- Complete bounded JPEG marker and PNG chunk/CRC/decompression validation.
  HEIC/HEIF parses a bounded top-level ISO-BMFF envelope but deliberately
  returns `unsupported_format` because no authorized bounded full decoder is
  deployed.
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
| Worker | 6 files and 31 tests passed: configuration/role, queue handler, structure/PDF, scanner, cancellation, and workspace recovery |
| API | 3 files and 24 tests passed, including safe file status and minimized dispatch |
| Domain | 7 files and 34 tests passed, including validation transitions and limits |
| Database | 3 files and 31 tests passed, including migration checksum/grants |
| Crypto | 3 files and 7 tests passed, including streamed authenticated file decrypt |
| Observability | 5 files and 17 tests passed, including validation log allowlists/canaries |
| Contracts | 2 files and 15 tests passed |
| Disposable Aiven | Migrations 0001-0007 and pg-boss v37 prepared; atomic minimized dispatch, worker DDL denial/direct-read denial, minimum claim, cleanup-gated commit, RLS/BOLA, retry exhaustion, and plaintext canaries passed |
| Gate 1 RLS regression | PostgreSQL 17.10 no-context, cross-household visibility/update/insert denial passed |

The disposable Aiven suite uses generated identifiers and ciphertext metadata
only. It creates and removes its database. Docker was unavailable locally, so
no local ClamAV container result is claimed; scanner protocol and failure
behavior are unit-tested, while the real scanner evidence is Railway staging.

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
- Worker probe deployment `ce1d8a3d-562e-4b65-8085-dc95b8526b6d` printed:
  `VLT-05 staging probe passed: bounded QPDF sandbox, fresh private scanner,
  clean/detected matrix, previews off, and workspace cleanup.`
- The probe generated its benign bytes and EICAR string at runtime, verified
  scanner readiness/current signature attestation, produced clean and detected
  outcomes, executed the QPDF sandbox, removed its opaque workspace, and then
  started the worker.
- The final steady worker deployment is
  `db84c331-0037-4e12-89a3-01e913ebca45`, after the probe switch was reset to
  false. Startup and repeated safe heartbeat events confirm QPDF,
  scanner readiness, database role assumption, queue grants, and runtime
  health.

The Railway CLI's interactive SSH probe command could not run because the
account has no registered SSH key. No durable account credential was added.
Instead, the documented staging-only startup probe switch was enabled for one
deployment and reset to false for the final deployment.

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
- enable previews, OCR, extraction, record linkage, search, or automatic
  rendering of rejected originals;
- prove a full authenticated mobile-upload-to-staging-worker lifecycle; staging
  proves the deployed parser/scanner/cleanup/runtime boundary while disposable
  Aiven proves the full database lifecycle separately;
- claim successful HEIC decode: HEIC remains fail-closed until a reviewed
  resource-bounded decoder is authorized and deployed;
- prove local real-ClamAV integration, physical Android/iOS, two-device,
  low-end Android, or full assistive-technology behavior; or
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

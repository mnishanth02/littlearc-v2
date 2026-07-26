# VLT-05-F3 Encrypted Server Previews Implementation Evidence

> **Status:** Complete; implementation, disabled-state evidence review, and
> staging-only enablement validation passed
> **Evidence date:** 2026-07-26
> **Last updated:** 2026-07-26
> **Owner:** Engineering
> **Milestone:** M3
> **Plan:** [VLT-05-F3 plan](./vlt-05-f3-encrypted-server-previews-plan.md)
> **Decision:** [ADR-0016](../../adr/0016-worker-file-validation-and-plaintext-cleanup-boundary.md)
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)

---

## Outcome

VLT-05-F3 is implemented and validated within its synthetic local,
disposable-Aiven, and Railway-staging boundary. It adds an independently
encrypted `validation-preview-v1` derivative, cleanup-gated worker pipeline,
least-authority database lifecycle, private encrypted-object storage, and a
household/device-authorized ciphertext grant.

`FILE_PREVIEWS_ENABLED=true` only on Railway staging after separate founder
approval. The enabled worker found no eligible staged source and therefore did
not create a derivative job. Production was untouched and still has no service
instances. Gate 2 remains open, real data remains prohibited, and `VLT-05-F4`
and `VLT-06+` remain outside this authorization.

## Implemented Boundary

- Migration `0008_vlt_05_f3_file_previews` adds one immutable derivative per
  source/kind/policy version, explicit lease/cleanup states, minimized outbox,
  RLS, worker function-only grants, API grant function, and safe failure codes.
- `file-preview-v1` and `file-preview-dead-v1` use minimized opaque payloads,
  deterministic dispatch, bounded retries, recovery, and idempotent candidate
  creation.
- JPEG, PNG, accepted single-image HEIC, and page 1 of an accepted static PDF
  render to a bounded baseline JPEG using a deterministic size/quality ladder.
- Rendering uses fixed Poppler arguments, the existing isolated UID and
  no-new-privileges/resource boundary, and a shared parser permit. PDF
  annotations are hidden and no text layer, links, forms, or embedded content
  are copied.
- Output is fully decoded, malware-scanned again, checked for canonical JPEG
  structure and metadata absence, encrypted with a fresh random DEK/nonce and
  derivative AAD, then written under an opaque private derivative key.
- A derivative can become ready only after encrypted-provider upload,
  ciphertext hash verification, local plaintext removal, and verified
  workspace absence. Retry/recovery removes failed provider candidates.
- `GET /v1/files/{fileObjectId}/preview` returns a five-minute,
  `private, no-store` ciphertext grant only for an active authorized device and
  a ready derivative. It never returns plaintext.

## Exact Renderer And Supply-Chain Boundary

The worker keeps Node.js 26.4.0, Sharp 0.34.5, libvips 8.17.3, QPDF 12.3.2,
and the accepted HEIC codec pins. F3 adds only the reviewed Debian Bookworm
runtime/build packages:

- libjpeg-turbo `1:2.1.5-2`;
- libpng `1.6.39-2+deb12u5`; and
- Poppler utilities `22.12.0-2+deb12u2`.

The custom libvips build enables JPEG and PNG while keeping its Poppler loader
disabled; PDF rasterization remains a separate fixed-argument `pdftoppm`
process. The exact versions are confirmed by Debian's official package records
for [libjpeg](https://packages.debian.org/bookworm/libjpeg62-turbo-dev),
[libpng](https://packages.debian.org/bookworm/libpng-dev), and
[Poppler utilities](https://packages.debian.org/bookworm/poppler-utils).

## Automated And Database Evidence

The following commands passed:

```sh
pnpm --filter @littlearc/worker test
pnpm --filter @littlearc/worker typecheck
pnpm test:unit
pnpm test:contract
pnpm test:integration:file-preview
pnpm test:database:file-preview
pnpm check:generated
pnpm check:railway
pnpm check:supply-chain
pnpm check:format
git diff --check
```

Focused results:

| Surface | Result |
| --- | --- |
| Worker | 10 files and 45 tests passed, including render protocol, handler publication/cleanup ordering, queue payload/idempotency, configuration containment, validation, scanner, and workspace behavior |
| API | 3 files and 25 tests passed, including the ciphertext-only grant |
| Contracts | 2 files and 16 tests passed, including strict preview response generation |
| Database | 3 files and 33 tests passed, including migration checksum and grants |
| Domain | 7 files and 35 tests passed, including deterministic preview policy |
| Crypto | 3 files and 8 tests passed, including derivative-specific AAD |
| Storage | Provider-neutral derivative write/hash/delete tests passed |
| Local integration | Synthetic JPEG, PNG, HEIC, and PDF rendering, bounds, metadata stripping, fresh encryption, opaque provider round trip, authenticated decrypt, delete, and cleanup passed |
| Disposable Aiven | Migrations 0001-0008, candidate/outbox/lease, cleanup gate, grant, RLS/BOLA, deletion, retry exhaustion, original-readiness isolation, and plaintext-canary absence passed; the database was removed |

## Railway Staging Evidence

Only the existing staging project changed.

- Migration `0008_vlt_05_f3_file_previews` was applied with checksum
  `bb7e5a0164bbf314e4a9679443579ace24cc58a0a617416325f715a04483e78d`.
- pg-boss schema version 37 and both preview queues were prepared with the
  migration credential boundary.
- Probe deployment `5fb34244-9e34-48d6-bcb3-c08b952857af` passed on image
  digest
  `sha256:aab1553a56cb04124bfb203774e5c0203ed5d9359b541d1fc0d466b077d1bfa8`.
  Its safe result was:
  `VLT-05-F3 staging probe passed: exact bounded renderers, synthetic format
  matrix, metadata and annotation controls, encrypted private-provider round
  trip, fresh scanner, previews off, and workspace cleanup.`
- Final steady worker deployment
  `3fb96887-ffb9-4268-8e98-c5a0d625f0f3` is `SUCCESS` on the same image.
  Its logs contain only the safe start/heartbeat lifecycle fields.
- API deployment `647f9441-25cc-48e0-a5ae-57d421b68e03` is `SUCCESS` on image
  digest
  `sha256:e0b4afcf550e6a370cb763348567ba1767eea17eecb807def03e07559c7af75a`.
  `/health/live`, `/health/ready`, and the generated preview route in
  `/v1/openapi.json` passed.
- Steady variables were re-read as
  `FILE_VALIDATION_STAGING_PROBE=false`,
  `FILE_PREVIEWS_ENABLED=false`, and
  `PDFTOPPM_EXECUTABLE=/usr/bin/pdftoppm`.
- The direct probe deleted its encrypted derivative candidate and temporary
  workspace. The derivative table contained zero rows after validation.

### Enabled Staging Validation

After founder review of the disabled-state evidence:

- `FILE_PREVIEWS_ENABLED=true` was set only on
  `littlearc-worker-staging`; `FILE_VALIDATION_STAGING_PROBE=false` remained
  the steady probe-switch setting.
- The mandatory predeploy probe was generalized to verify the actual authorized
  preview state instead of rejecting every enabled deployment. It retained the
  same exact dependency, four-format render, annotation/metadata, fresh
  scanner, encrypted provider round-trip, deletion, and workspace checks.
- Enabled deployment `2b3b267f-68a4-4501-a766-6c351a2a170a` reached
  `SUCCESS`. Its probe reported:
  `VLT-05-F3 staging probe passed: exact bounded renderers, synthetic format
  matrix, metadata and annotation controls, encrypted private-provider round
  trip, fresh scanner, previews enabled, and workspace cleanup.`
- Final exact-source deployment `ce0f48c2-5653-4b93-917e-50fd044e53ff`
  reached `SUCCESS` on image digest
  `sha256:3eb9e7e63161e09ba29a727feddbbd0eef2413beabdc536b9786ac9b92c262a3`
  after the source-controlled staging manifest and dependency policy were
  aligned to the authorized enabled state. It repeated the same enabled probe,
  start, and heartbeat evidence.
- The worker started only after preview queue schema/version checks, renderer
  capability, scanner readiness, recovery, and the first bounded dispatch
  completed. It then emitted normal start and heartbeat events.
- A bounded log scan found zero warning/error outcomes and zero forbidden
  data-field terms.
- Post-enable PostgreSQL/provider checks found zero eligible sources, zero
  derivative rows, zero preview jobs, and zero `derivatives/` objects. This
  preserves the synthetic-only boundary and does not claim F4 authenticated
  mobile lifecycle evidence.
- Railway SSH workspace inspection was unavailable because no SSH key is
  registered. Cleanup nevertheless passed in the executable predeploy probe,
  and the independent database/provider checks found no residual candidate.
- API live/readiness remained healthy, production retained zero service
  instances, and no API, database, bucket, service, or variable outside staging
  changed.
- A final `railway up` of the same workspace state for both staging services
  returned `SKIPPED` with `No changes to watched files`
  (`63d235cf-8961-4ee4-b1a2-37b02dbee204` API and
  `fc018735-db4b-4a48-8790-6140ea7bb105` worker). This is recorded as a
  source-equivalence no-op, not as a new successful release. The active
  successful deployments remain API
  `647f9441-25cc-48e0-a5ae-57d421b68e03` and worker
  `ce0f48c2-5653-4b93-917e-50fd044e53ff`; live/readiness, the preview route,
  enabled worker heartbeat/probe, staging-only variables, and the empty
  production service list were rechecked.

The first image attempt failed before deployment because the renderer
capability probe emitted libheif's numeric library version instead of the
accepted `system` capability label. The probe was corrected, focused checks
passed again, and the subsequent exact image and staging probe succeeded. The
previous healthy worker remained active throughout the failed build.

## Security And Privacy Evidence

- Synthetic fixtures only; no real child, household, participant, or medical
  document data was used.
- Queue payloads contain only an opaque derivative identifier.
- Logs and evidence contain no file-object/derivative/household/child data
  identifiers, filenames, object keys, paths, signed URLs, keys, AAD, document
  content, or plaintext canaries. Railway deployment identifiers are retained
  solely as infrastructure audit evidence.
- PostgreSQL and private object storage retain ciphertext, wrapped key
  material, dimensions, safe states/codes, and provider-integrity facts only.
- Preview failure and retry exhaustion leave the trusted original `ready`.
- No public preview object or plaintext API response exists.

## Mobile Boundary

No Android or iOS source changed. The post-enablement proof below is limited to
build/install/launch regression; no native preview-consumer claim is made. A
future separately planned Vault consumer must define device-side decryption,
protected memory/cache behavior, lifecycle clearing, and accessibility/device
evidence.

### Applicable Mobile Regression — 26 July 2026

After staging enablement, the unchanged mobile client was rebuilt and exercised
only as an applicable regression boundary:

- `pnpm --filter @littlearc/mobile test`, typecheck, and both release exports
  passed; 17 test files and 66 tests passed, and both export bundles passed the
  validation-route containment check.
- The current Android development APK built successfully, installed on the
  attached physical Pixel 8 (`3A110DLJH000U7`, Android 17), loaded the current
  Metro bundle, registered the React Native `main` application, and rendered
  the synthetic-only LittleArc home screen. The focused post-launch scan found
  no fatal exception or unhandled React Native error.
- The current iOS development client built successfully for the iPhone 17 Pro
  Simulator (`7C8183EE-08E8-4F3D-A064-D3C404A10CC9`, iOS 26.5). An unsigned
  compile artifact was not accepted for runtime evidence because SecureStore
  correctly rejected its missing Keychain entitlement. The app was rebuilt
  with simulator ad-hoc signing, reinstalled, loaded the current bundle, and
  rendered the synthetic-only LittleArc home screen. The focused post-install
  scan found no SecureStore/Keychain, fatal, uncaught, or unhandled error.
- Temporary Metro and ADB reverse rules used for the proof were removed.

This proves build/install/launch regression only. F3 still has no mobile Vault
preview consumer, so this is not preview retrieval/decryption, full-stack
mobile-to-staging, physical-iOS, or two-device evidence.

## Remaining Boundary

F3 implementation and staging-only enablement are complete. Production
enablement, real data, a mobile Vault consumer, F4 authenticated lifecycle
evidence, Gate 2 closure, and `VLT-06+` remain unauthorized.

# VLT-04 File Encryption And Resumable Upload Plan

> **Status:** Complete
> **Plan state:** Reviewed, accepted, and authorized for implementation
> **Started date:** 2026-07-25
> **Last updated:** 2026-07-25
> **Completion date:** 2026-07-25
> **Owner:** Engineering
> **Milestone:** M3
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
> **Roadmap:** [M3 Vault Wedge](../roadmap.md#m3--vault-wedge)
> **Research:** [File transport research](./vlt-04-file-encryption-and-resumable-upload-research.md)
> **Evidence:** [Implementation evidence](./vlt-04-implementation-evidence.md)

---

## Outcome

An authenticated parent on an active enrolled device can upload a synthetic
VLT-03 capture asset as already-encrypted ciphertext, see truthful
restart-safe progress, retry or cancel without losing the local source, and
resume after network loss, signed-URL expiry, or app termination.

The API authorizes the file-object boundary, wraps the per-file key immediately,
coordinates multipart object storage, verifies the complete ciphertext size and
SHA-256 digest, and never stores plaintext file bytes or keys. An authorized
enrolled device can later download the ciphertext, verify it, store its local
key wrapping, and decrypt only within the accepted foreground preview
lifecycle.

Completion of VLT-04 means `uploaded` and integrity-checked ciphertext. It does
not mean that a document is safe, parsed, scanned for malware, ready for OCR,
linked to a record, searchable in Vault, or accepted for real data.

## Authorization And Gate Boundary

Gate 2 remains open. The founder request on 25 July 2026 authorized VLT-04
planning and required explicit plan acceptance before implementation. The
founder accepted this plan on 25 July 2026 and separately authorized the
bounded implementation and validation described here.

Once accepted, the package-specific exception will authorize only the bounded
VLT-04 implementation and staging/device evidence described here. It will:

- not close Gate 2 or authorize VLT-05 and later M3 packages;
- not replace missing two-physical-device, low-end Android, complete
  assistive-technology, or physical-iOS evidence;
- not permit real child, parent, clinical, document, provider, or government
  data;
- not provision or enable production object storage;
- not claim end-to-end encryption, because the API has transient key-wrapping
  and authorized-download authority; and
- not broaden signed-distribution, pilot, production, or real-data claims.

## Scope

### Cryptography And Local Migration

- Reuse the VLT-03 per-file DEK and ciphertext instead of producing a second
  encrypted upload copy.
- Define versioned canonical file AAD containing:
  - household ID;
  - immutable UUIDv7 file-object ID;
  - capture-asset purpose;
  - content format; and
  - AAD protocol version.
- Encrypt every new capture asset directly with upload-ready AAD.
- Atomically reseal existing VLT-03 AAD-v1 assets before first upload:
  - decrypt only after the accepted foreground unlock;
  - write new ciphertext to an opaque temporary path;
  - use a fresh DEK, nonce, and transport AAD;
  - commit metadata and rename atomically;
  - delete the superseded ciphertext only after commit; and
  - preserve the original on every interruption or failure.
- Extend `@littlearc/crypto` with a provider-neutral file-key interface for
  wrap, unwrap, rewrap, and current key version.
- Add SQLCipher schema V8 for durable upload session/part state, without
  persisting URLs, credentials, plaintext keys, or provider secrets.

### Storage Package

- Add `@littlearc/storage` as the provider-neutral ciphertext-object boundary.
- Implement the selected S3-compatible adapter with exact-pinned AWS SDK
  packages required for multipart operations and presigned URLs.
- Support initiate, sign part, list/reconcile parts, complete, abort, head,
  stream-hash, sign download, and delete.
- Use opaque server-generated object keys and fixed 5 MiB non-final parts.
- Keep provider-specific response shapes and credentials inside the adapter.
- Add a deterministic fake adapter for unit and local Aiven integration tests.

### Database And Authorization

- Add reviewed migration `0006_vlt_04_file_upload.sql`.
- Add tenant-owned `upload_sessions` and `file_objects` with:
  - household and creator authority;
  - intended active child and capture-asset identifiers;
  - opaque provider upload/object identifiers;
  - expected ciphertext size and SHA-256 digest;
  - part state and expiry;
  - wrapped DEK, wrapping version, content nonce/tag, and AAD version;
  - upload, integrity, and future-processing states;
  - safe failure codes and timestamps; and
  - append-only audit, idempotency, RLS, and BOLA coverage.
- Keep `record_file_links` out of VLT-04. An uploaded but unvalidated object is
  not a confirmed record attachment.
- Derive household and parent authority from the authenticated session.
- Require the existing add-record capability, an active same-household child,
  and an active device enrollment owned by the session user.
- Add a least-authority cleanup operation that lets the worker claim expired
  sessions without receiving file-key or household-key access.

### Contracts And API

- Activate the reserved `/v1/files` contract surface for:
  - create upload session;
  - obtain or refresh a part URL;
  - reconcile uploaded parts;
  - complete upload;
  - cancel upload;
  - inspect safe upload status; and
  - obtain authorized download material.
- Regenerate OpenAPI and mobile client outputs and keep generated drift checks
  active.
- Validate limits and metadata before object-storage initiation.
- Accept a 32-byte DEK only in the authorized create-session request, wrap it
  immediately, clear the transient buffer, and persist only wrapped material.
- Make create, complete, and cancel idempotent with the accepted idempotency
  boundary.
- Reconcile provider `ListParts` results before completion.
- Stream the completed ciphertext through SHA-256 and compare the full digest
  and size before marking it `uploaded`.
- Delete a completed object and mark the session safely failed on integrity
  mismatch.
- Return only short-lived signed URLs and safe transport fields; set responses
  to prevent intermediary caching.
- Require a currently authorized enrolled device for download, unwrap the file
  key transiently, and return it only over authenticated TLS with a short-lived
  signed ciphertext URL.
- Add an `UPLOADS_ENABLED` server kill switch that is false by default and
  separately configured in staging. A disabled or unhealthy storage boundary
  fails closed with safe `503` behavior.
- Extend readiness so enabled uploads require a healthy configured storage
  adapter.

### Worker Cleanup

- Add a bounded periodic worker job for expired upload sessions.
- Claim small batches through the least-authority database operation, abort the
  provider multipart upload, and record terminal expiry only after cleanup.
- Retry provider cleanup with safe backoff and no document/key access.
- Make cancel/expiry races and repeated aborts idempotent.
- Prove an expired multipart session cannot remain silently orphaned when
  Railway has no lifecycle configuration.

### Mobile Upload And Download

- Add an upload orchestrator under `apps/mobile/src/capture/` that:
  - computes ciphertext SHA-256 with bounded reads;
  - creates or resumes the server session;
  - materializes one opaque 5 MiB cache part at a time;
  - uploads directly through the current signed URL;
  - persists part number/ETag immediately in SQLCipher;
  - removes every temporary part in a `finally` path;
  - reconciles ambiguous results after restart;
  - refreshes expired URLs;
  - cancels both local work and server multipart state; and
  - preserves the original local ciphertext on all failures.
- Extend the capture draft screen with semantic upload, retry, cancel, progress,
  offline, and uploaded-pending-validation states.
- Never display false completion while only a local part or provider multipart
  upload is complete.
- Add download/import behavior that verifies ciphertext size/digest before
  locally wrapping the DEK and exposing a foreground preview.
- Reject wrong household/object AAD and tampered ciphertext before preview.
- Delete plaintext preview material on background, lock, sign-out, cancellation,
  and failure through the existing local-security lifecycle.
- Keep development-only synthetic orchestration release-excluded.

### Staging Delivery And Documentation

- Keep automated database validation on disposable local Aiven with fake
  storage. Do not combine the local Aiven database with Railway storage.
- Apply the reviewed migration to Railway staging only.
- Wire the staging API and worker to the existing
  `littlearc-documents-staging` bucket through Railway variable references;
  never print or commit credentials.
- Deploy only saved staging API/worker application state and verify terminal
  deployment health before device acceptance.
- Run a synthetic provider probe and clean every test object and incomplete
  upload afterward.
- Create ADR-0015 for file encryption, key wrapping, resumable transport, and
  authorized download.
- Create the VLT-04 evidence dossier and update:
  - `docs/IMPLEMENTATION_STATUS.md`;
  - this plan and M3 index;
  - `docs/index.md` and `docs/context-map.yaml`;
  - `docs/adr/README.md`;
  - environment and development/release references;
  - Railway manifest/watch-path validation; and
  - `docs/impl-plan/roadmap.md`, recording the reviewed package-specific
    authorization and exact bounded completion without marking Gate 2 closed.

## Out Of Scope

- Magic-byte revalidation, bounded PDF parsing, active-content rejection,
  malware scanning, quarantine, safe derivative previews, and validation
  readiness (`VLT-05`).
- OCR, extraction suggestions, processor consent, and review (`VLT-06`).
- Record confirmation or correction based on a capture; `record_file_links`;
  attachment provenance; vaccination, visit, or prescription behavior
  (`VLT-06`/`VLT-07`).
- Full Vault search, ranking, filters, or multi-record retrieval (`VLT-08`).
- Generic duplicate-document and cross-flow conflict UX (`VLT-09`).
- Background OS transfer while the app is suspended. VLT-04 guarantees
  restart-safe application multipart resume, not an always-running native
  background upload service.
- End-to-end or zero-knowledge encryption claims.
- Production bucket provisioning, production deployment, production feature
  enablement, lifecycle rules, real-data migration, or pilot rollout.
- Physical iPhone/Secure Enclave acceptance, a second physical device,
  low-end-Android performance, and the complete assistive-technology matrix.

## Source Traceability

| Requirement or boundary | Source |
| --- | --- |
| VLT-04 scope and ordering | Roadmap Section 12.1 |
| Device encryption, AAD, key wrapping, upload/download flow | Architecture Sections 15 and 16 |
| Upload/file tables, states, retention, signed URLs | Backend data model Section 13 |
| Offline queue, retry/cancel, source preservation, truthful state | Mobile application flow Sections 12, 14, 15, 17, 18, 20, and 24 |
| Local file encryption and foreground key custody | ADR-0011 and VLT-03 implementation |
| Household authority, capability, enrollment, RLS/BOLA | OFF-02 through OFF-04 |
| Safe logging, flags, crash/analytics canaries | FND-07 |
| S3 multipart and presigned transport | Railway and Amazon S3 primary documentation in the research note |
| Bounded file reads/uploads | Expo SDK 57 FileSystem documentation |

## Dependencies

- Accepted VLT-03 capture drafts, V7 wrapped file keys, local native processor,
  and physical-Android/iOS-Simulator native baseline.
- Accepted OFF-01 through OFF-04 session, household, enrollment, local-security,
  synchronization, idempotency, audit, and RLS boundaries.
- Accepted FND-04 through FND-07 contracts, database, Railway staging, and
  observability foundations.
- Node.js 26.4.0 and pnpm 11.14.0.
- Ignored local `.env.aiven` and disposable Aiven database privileges for
  automated integration validation.
- Authenticated Railway CLI/session, staging project access, existing staging
  PostgreSQL and documents bucket, and permission to deploy staging API/worker.
- Connected physical Android device and installed Android build tools.
- Booted iOS Simulator, Xcode, CocoaPods, and the existing development-client
  build boundary.
- Explicit founder acceptance of this plan before production implementation.

## Reviewed Decisions

1. **Encrypt once.** New capture ciphertext is upload-ready. Existing VLT-03
   files are atomically resealed once because their local-v1 AAD lacks
   household/object binding.
2. **Allocate the file-object ID offline.** The immutable client UUIDv7 lets
   encryption AAD be final before network availability. The API validates
   uniqueness and tenant ownership rather than replacing it.
3. **The API can wrap and unwrap.** This follows the accepted envelope model and
   avoids a false end-to-end claim. Plaintext DEKs exist only in bounded request
   memory and are zeroed after use.
4. **Use direct multipart ciphertext upload.** The API authorizes and signs;
   file bytes do not proxy through the API.
5. **Use 5 MiB parts.** This satisfies the S3 minimum for non-final parts and
   bounds cache/memory under the accepted 25 MB input limit.
6. **Persist part facts, not URLs.** SQLCipher stores part number, ETag, and
   state. Signed URLs are refreshed and never persisted.
7. **Verify the full object independently.** Provider multipart ETags and
   composite checksums are not the accepted SHA-256 ciphertext digest. The
   storage adapter streams the completed ciphertext and checks the full hash.
8. **Uploaded is not ready.** VLT-04 stops at accepted encrypted storage with
   future validation state `pending`; VLT-05 owns document safety.
9. **Do not link a record.** A capture asset and file object stay outside the
   confirmed record aggregate until later validation/review packages.
10. **Worker cleanup has no decryption authority.** It sees only opaque expired
    multipart identifiers through a least-authority database operation.
11. **Staging is the provider proof.** Local automated validation uses Aiven
    plus fake storage. Live Railway bucket evidence uses the complete Railway
    staging stack and synthetic data.
12. **Uploads default off.** The server flag and readiness boundary prevent a
    partially configured or emergency-disabled environment from accepting
    sessions.
13. **No background-service expansion.** Restart-safe app-managed multipart
    resume satisfies this package; native suspended transfers need separate
    product/privacy review.
14. **Node 26.4.0 is the active repository runtime.** The root and retained M0
    harness pins align with the installed global runtime; historical evidence
    remains an accurate record of the Node version used at the time.

## Data And Trust Review

| Data | Classification | Location and control |
| --- | --- | --- |
| Local source ciphertext | Restricted child/health | App-private file; independent AES-256-GCM DEK; SQLCipher metadata |
| Plaintext preview | Restricted child/health | Foreground-only temporary file; mandatory cleanup |
| File DEK in mobile | Restricted key material | Wrapped under local foreground key except bounded crypto operation |
| File DEK in API | Restricted key material | Authenticated TLS request/response memory only; immediate wrap/clear; no log/cache |
| Wrapped file DEK | Restricted key material | Household-scoped PostgreSQL row with versioned wrapping metadata |
| Object ciphertext | Restricted encrypted data | Opaque Railway staging key; application encryption; synthetic only |
| Ciphertext digest/ETag/storage key | Confidential operational metadata | SQLCipher/PostgreSQL only; excluded from telemetry and UI |
| Signed URL | Restricted transport capability | In-memory short-lived transport only |
| Upload status/safe code | Private operational state | SQLCipher/PostgreSQL; allowlisted user and operational presentation |

## Module Status

| Module | Status | Notes |
| --- | --- | --- |
| Context, current code, and provider research | Completed | Project sources, current staging bucket, S3, Railway, and Expo behavior reviewed |
| Plan and authorization boundary | Completed | Founder accepted the reviewed plan on 25 July 2026 |
| Node 26.4.0 repository pin | Completed | Root and retained M0 harness pins aligned; toolchain and Expo Doctor pass |
| ADR-0015 | Completed | Accepted protocol and trust boundary are documented and indexed |
| Crypto and local AAD migration | Completed | Unit, migration, tamper, and local device-flow checks pass |
| Provider-neutral storage package | Completed | Fake and exact-pinned S3-compatible adapter checks plus the live staging probe pass |
| Database migration and RLS | Completed | Reviewed SQL, disposable local Aiven upload/RLS validation, and hosted migration/checksum confirmation pass |
| Contracts and generated clients | Completed | `/v1/files` surface, generated drift, and contract checks pass |
| API upload/download lifecycle | Completed | Concurrent exact replay passes; changed metadata/key replays fail closed; redundant provider uploads are aborted |
| Worker expiry cleanup | Completed | Provider-abort and finish failures are isolated per claim and cannot reject the timer batch |
| Mobile upload/download UX | Completed | Restart/resume/download/tamper flow passes on the physical Pixel 8 and iOS Simulator |
| Focused and broad automated validation | Completed | Unit, contract, type, Aiven, workspace, format, docs, build, release containment, Expo Doctor, root, and clean-checkout checks pass |
| Physical Pixel 8 acceptance | Completed | Physical fingerprint unlock plus SQLCipher V8, interrupted multipart resume, download, tamper rejection, safe logs, and cleanup pass |
| iPhone 17 Pro Simulator acceptance | Completed | Development-only local Aiven/in-memory-provider interruption, resume, download, and tamper-rejection proof passed |
| Railway staging provider acceptance | Completed | Hosted migration, final healthy API/worker deployments, direct multipart provider probe, readiness, and cleanup pass |
| Evidence and documentation close-out | Completed | Evidence dossier and status, index, context-map, M3, roadmap, ADR, environment, and release references are aligned |

## Completion Checkpoint — 25 July 2026

The final implementation and evidence are recorded in the
[VLT-04 evidence dossier](./vlt-04-implementation-evidence.md). Package
completion does not close Gate 2 or authorize `VLT-05`.

Passed:

- `pnpm test:unit`
- `pnpm test:contract`
- `pnpm typecheck`
- `pnpm check:workspace`
- `pnpm check:format`
- `pnpm check:docs`
- `pnpm test:database:rls`
- `pnpm test:database:record`, including encrypted multipart resume,
  ciphertext-integrity, tenant/revocation, metadata-only storage, and
  least-authority cleanup assertions
- `pnpm build`, including Android/iOS release exports and validation-route
  containment
- `pnpm --filter @littlearc/mobile exec expo-doctor` (`20/20`)
- live Railway staging multipart initiate, signed part, list, complete, head,
  digest, download, repeated abort, and empty-bucket cleanup probe
- Railway migration `0006_vlt_04_file_upload` is present with the expected
  checksum; final API deployment `74266165-d505-4179-b4c0-38f1bd8b51d8`,
  worker deployment `0d7600b0-c0bf-43d4-8343-2c8b8ec3c5cc`, and
  `/health/ready` pass
- physical Pixel 8 development-only synthetic interruption, saved-part resume,
  authenticated download, tamper rejection, semantic result, and log-safety
  flow after physical fingerprint unlock
- iPhone 17 Pro Simulator development-only synthetic interruption, resume,
  authenticated download, and tamper-rejection flow
- API concurrent replay/changed-request remediation and worker per-claim
  failure-isolation regression tests
- `pnpm validate`
- clean Android/iOS prebuild, Pixel-target arm64 debug APK, and iPhone 17 Pro
  Simulator native build
- `./tooling/validate-clean-checkout.sh`
- `git diff --check`

Explicit evidence boundary:

- Device validation intentionally uses disposable local Aiven plus an in-memory
  multipart provider. The real Railway staging provider is proven separately
  by the hosted migration, deployed API/worker, readiness, and direct provider
  probe. The device runs are not staging-connected-device evidence.
- Physical iOS, two-device, low-end Android, complete assistive-technology,
  production, real-data, and Gate 2 claims remain open in their named gates.

## Implementation Plan

1. Finalize this plan after founder review. Record the bounded VLT-04
   authorization in the dashboard, M3 index, and roadmap without changing Gate
   2.
2. Add ADR-0015 and exact protocol constants: AAD serialization, state machines,
   part size, signed-URL TTLs, expiry, digest semantics, and key-memory rules.
3. Implement pure domain/crypto/storage types and tests first, including
   wrong-AAD, tamper, invalid transition, hash, part-order, and safe-error
   behavior.
4. Add `@littlearc/storage`, fake storage, S3 adapter, configuration
   classification, environment enforcement, and workspace/Railway boundary
   checks.
5. Add Drizzle schema and reviewed migration 0006 with tenant RLS, BOLA,
   idempotency, audit, and least-authority worker cleanup operations.
6. Extend contracts/OpenAPI/generated clients for the exact upload and download
   lifecycle.
7. Implement API session creation, immediate wrapping, signed-part refresh,
   reconciliation, completion/full digest verification, cancel, status,
   download, kill switch, and readiness.
8. Implement worker expiry cleanup and deterministic race/retry tests.
9. Add SQLCipher V8, transport-AAD sealing/resealing, multipart repository, and
   restart-safe mobile orchestrator.
10. Add the production capture upload/status/retry/cancel/download UI and
    development-only synthetic validation orchestration.
11. Run focused unit/contract/database/native tests; fix failures before broad
    validation.
12. Run complete repository, clean-checkout, release-containment, Android
    arm64, and iOS Simulator build validation on Node 26.4.0.
13. Apply the migration and configuration to Railway staging, deploy API and
    worker, run the provider probe, and prove stale multipart cleanup.
14. Run the complete physical Pixel 8 and iPhone 17 Pro Simulator acceptance
    matrices against synthetic staging data, capturing screenshots, semantic
    state, logs, and safe cleanup evidence.
15. Create the evidence dossier, review the final diff, align all documentation
    including the roadmap, and mark VLT-04 complete only within its exact
    automated/provider/device boundary.

## Acceptance Criteria

1. A VLT-03 capture asset becomes upload-ready ciphertext without a persistent
   plaintext or duplicate encrypted upload copy.
2. Existing AAD-v1 assets reseal atomically and remain recoverable after an
   interrupted migration.
3. Wrong household, file-object, purpose, format, AAD version, key, nonce/tag,
   or modified ciphertext fails authenticated decryption.
4. The API rejects unauthenticated, revoked, inactive-enrollment,
   cross-household, invalid-child, over-limit, malformed, duplicate-conflict,
   and disabled-upload requests with safe errors.
5. No plaintext DEK is stored, logged, cached, or exposed outside the bounded
   authenticated create/download operations.
6. Multipart upload progresses in bounded parts and survives network loss,
   process termination, expired URLs, and ambiguous part results without
   restarting already accepted parts.
7. Part cache files and signed URLs do not survive their bounded use.
8. Completion is idempotent and accepts only an ordered provider part set whose
   final ciphertext size and full SHA-256 digest match.
9. Digest/size mismatch deletes the completed object, records a safe failure,
   and preserves the local source for retry.
10. Cancel and expiry abort provider multipart state idempotently and preserve
    the local encrypted source.
11. The cleanup worker can recover stale sessions but cannot access household
    keys, file keys, plaintext, or unrelated tenant data.
12. Download requires current household authorization and an active enrolled
    device; the device verifies ciphertext before local key import and preview.
13. Sign-out, revocation, background/lock, tamper, and cancellation make
    plaintext previews and protected local material inaccessible as specified
    by the accepted local-security boundary.
14. User-visible states distinguish local-only, queued, uploading, retrying,
    uploaded-pending-validation, failed, and cancelled.
15. No sensitive storage/key/hash/URL/filename value reaches logs, analytics,
    errors, screenshots, or release bundles.
16. Local Aiven tests and Railway staging provider tests remain separate.
17. The physical Pixel 8 and iPhone 17 Pro Simulator complete their applicable
    matrices; Simulator evidence is not reported as physical-iOS proof.
18. Root validation, native builds, release containment, staging health, and
    documentation governance pass on Node 26.4.0/pnpm 11.14.0.

## Validation

### Planning Gate

- Review this plan against the dashboard, roadmap, M3 index, architecture,
  backend schema, mobile flow, ADR-0011, VLT-03 implementation, and current
  source/tests.
- Verify Railway, S3 multipart, and Expo transport decisions against primary
  documentation.
- Run:

```sh
pnpm check:toolchain
pnpm check:docs
pnpm check:format
git diff --check
```

- Obtain explicit founder acceptance before Step 1 changes production source.

### Focused Automated Validation

Planned commands include the package-local test/typecheck tasks introduced by
the implementation plus:

```sh
pnpm test:database:file-upload
pnpm test:database:rls
pnpm test:contract
pnpm test:unit
pnpm typecheck
```

The focused matrix must cover:

- AAD serialization, key wrap/unwrap/rewrap, tamper, key clearing, and atomic
  reseal;
- storage initiate/sign/list/complete/abort/hash/download/delete;
- state transitions, retries, expiry races, part ordering, URL refresh, and
  idempotency;
- session/capability/enrollment/RLS/BOLA denial;
- full digest and size mismatch cleanup;
- SQLCipher V8 migration, restart, orphan cleanup, and sign-out wipe;
- mobile offline/restart/reconcile/cancel/download/tamper behavior;
- log, analytics, Sentry, and response leakage canaries; and
- release exclusion of synthetic validation content.

### Broader Repository And Native Validation

```sh
pnpm install --frozen-lockfile
pnpm check:workspace
pnpm check:format
pnpm check:docs
pnpm test
pnpm typecheck
pnpm build
pnpm validate
pnpm --filter @littlearc/mobile exec expo-doctor
pnpm --filter @littlearc/mobile run prebuild
pnpm --filter @littlearc/mobile run build:android:arm64
pnpm --filter @littlearc/mobile run build:ios:simulator
pnpm --filter @littlearc/mobile run export:release:android
pnpm --filter @littlearc/mobile run export:release:ios
./tooling/validate-clean-checkout.sh
git diff --check
```

Exact script names may follow the accepted package conventions discovered
during implementation; the evidence dossier must list every actual command,
pass/fail outcome, and unrun check.

### Railway Staging Provider Validation

- Confirm the environment is `staging`, production remains untouched, the
  documents bucket starts empty, and migration/application versions match.
- With synthetic random ciphertext only:
  - create a session;
  - upload multiple parts through presigned URLs;
  - list/reconcile parts;
  - complete, head, stream-hash, signed-download, and delete;
  - cancel an incomplete upload;
  - expire an incomplete upload and prove worker abort;
  - force a digest mismatch and prove object deletion;
  - revoke session/enrollment and prove download denial; and
  - verify no provider object or multipart residue remains.
- Verify API/worker health and safe logs without fetching or printing bucket
  credentials.

### Physical Android Validation

Target: the attached Pixel 8, resolved from `adb devices -l` at execution time.
Use the Railway staging HTTPS API so network interruption is not masked by ADB
reverse.

- Install a clean Android arm64 development build and enroll the device.
- Capture/import synthetic PNG and multi-part PDF assets and confirm
  upload-ready encryption.
- Queue while offline, relaunch, restore network, and start upload.
- Interrupt between parts by terminating the app; relaunch, reconcile, and
  resume without reuploading accepted parts.
- Exercise expired URL refresh and a real network interruption.
- Cancel an in-progress upload; verify the local source remains and server
  multipart state is gone.
- Complete upload, download the ciphertext, verify/decrypt it, background/lock,
  and confirm preview cleanup.
- Exercise tampered ciphertext, wrong AAD, revoked enrollment/session, retry,
  sign-out, and restart.
- Inspect semantic progress/status, 200% text layout, dark/high-contrast themes,
  safe screenshots, device logs, API/worker logs, and database/storage residue.
- Exercise the accepted 25 MB edge with synthetic bytes without claiming
  low-end-device performance.

### iOS Simulator Validation

Target: iPhone 17 Pro Simulator, resolved from `simctl` at execution time.

- Install a clean iOS Simulator development build and enroll with simulated
  Face ID.
- Use gallery/file synthetic sources; camera/scanner and physical
  Secure-Enclave behavior are not applicable evidence.
- Exercise offline queue, terminate/relaunch between parts, reconcile/resume,
  expired URL refresh, cancellation, successful completion, download/decrypt,
  background cleanup, tamper, wrong AAD, revocation, sign-out, and restart.
- Check 200% text, dark/high-contrast themes, semantic states, safe screenshots,
  Simulator logs, API/worker logs, and provider cleanup.
- Record the result as iOS-Simulator functional parity only.

## Risks And Controls

| Risk | Impact | Control |
| --- | --- | --- |
| Gate 2 exception is inferred too broadly | Unapproved M3 expansion | Require explicit plan acceptance; record bounded VLT-04 only |
| Existing AAD lacks upload context | Ciphertext substitution risk | Atomic one-time reseal with household/object/purpose/format AAD |
| API retains plaintext DEK | Key exposure | Immediate wrap/unwrap, bounded buffers, clear, no logs/cache, canaries |
| Multipart ETag is treated as content hash | Corruption accepted | Full ciphertext SHA-256 stream after completion |
| Signed URL is persisted or logged | Temporary write/read authority leaks | In-memory only, short TTL, redaction/canary tests |
| App termination loses progress | Reupload or false failure | SQLCipher part state plus server `ListParts` reconciliation |
| Provider lacks lifecycle rules | Orphaned parts and cost | Idempotent worker expiry abort with retry evidence |
| Cancel races completion | Inconsistent terminal state | Transactional state machine and idempotent provider reconciliation |
| Worker can decrypt | Excess privilege | Opaque cleanup claim only; no key interface/config |
| Uploaded is presented as safe | Unsafe document authority | Explicit `uploaded_pending_validation`; VLT-05 owns readiness |
| Local Aiven mixes with Railway staging | Environment/evidence confusion | Fake storage locally; complete live stack only in staging |
| New AWS dependencies expand supply chain | Security/build risk | Minimum exact pins, lockfile policy, dependency and bundle review |
| Node 26 breaks Expo/native tooling | Delivery blockage | Validate toolchain first, then Expo Doctor/prebuild/both builds |
| Provider/device evidence contains sensitive values | Privacy regression | Synthetic random fixtures, safe capture checklist, log scans |

## Plan Review And Finalization

This draft was reviewed against the live dashboard, roadmap, M3 index, product
architecture, backend data model, mobile flow, environment catalog, ADR-0011,
VLT-03 plan/research/implementation, current crypto/local-security/API/worker/
contract/database code and tests, the live Railway staging resource inventory,
and current Railway, Amazon S3, and Expo primary documentation.

Findings incorporated into the draft:

1. VLT-04 remains blocked by the prior delivery note. The current request is
   treated as planning authorization; founder plan acceptance becomes the
   named package-specific implementation authorization.
2. VLT-03 already solved independent local file encryption. Reusing the DEK and
   ciphertext avoids a second persistent encrypted copy, but old AAD requires
   an atomic compatibility migration.
3. Direct signed multipart transfer is supported by Railway, while lifecycle
   policies are not. Expired-session cleanup is therefore application scope,
   not an optional operations follow-up.
4. Expo upload tasks are cancellable but not durably resumable. SQLCipher part
   state plus provider reconciliation is the actual resume mechanism.
5. Multipart ETags and composite checksums do not satisfy the architecture's
   full ciphertext SHA-256 requirement. Completion includes a provider-neutral
   full-object stream hash.
6. `record_file_links` and validation readiness would incorrectly pull VLT-05
   through VLT-07 forward. VLT-04 stops at encrypted `uploaded` state.
7. Local Aiven and Railway storage must not be combined. Fake storage provides
   deterministic local database validation; the complete Railway staging stack
   provides live provider/device evidence.
8. The requested physical Android and iOS Simulator targets are currently
   available. Their evidence boundaries remain explicit.
9. The founder requested alignment with the installed Node 26.4.0. Active
   repository and retained-harness pins are updated separately from VLT-04
   production implementation; historical evidence is not rewritten.

The plan is not finalized until founder review accepts these decisions,
especially the API-visible DEK boundary, atomic AAD reseal, 5 MiB direct
multipart protocol, full post-completion ciphertext hash, worker-owned stale
cleanup, staging-only provider proof, and deferred record linking/validation.

## Manual Or Deferred Work After Implementation

No known manual action is expected for the requested synthetic VLT-04
functional flow if the current Railway, Android, Simulator, signing, and
database access remain available. The final evidence must report any newly
encountered prompt or access limitation precisely.

The following remain outside the agent-capable/requested acceptance boundary:

- user interaction if Android displays a permission/biometric prompt that
  cannot be safely automated or a physical camera fixture must be positioned;
- physical iPhone installation, camera/scanner, Secure Enclave, and production
  Share Extension/App Group proof;
- a second physical enrolled device and the remaining Gate 2 conflict matrix;
- target low-end Android and complete TalkBack/VoiceOver assistive-technology
  walkthroughs;
- production bucket/environment provisioning and production feature enablement;
- real medical-document, legal/privacy, pilot, and clinical acceptance.

## Follow-Up

- VLT-05 validates uploaded ciphertext content, quarantines unsafe files, and
  creates safe derived artifacts when authorized.
- VLT-06 runs on-device OCR and separates suggestions from confirmed facts.
- VLT-07 or later links accepted file objects to confirmed record versions.
- VLT-08 adds complete Vault retrieval/search behavior.
- VLT-09 adds cross-flow duplicate and failure handling.
- Gate 2 and pre-pilot evidence close independently; VLT-04 completion cannot
  close them.

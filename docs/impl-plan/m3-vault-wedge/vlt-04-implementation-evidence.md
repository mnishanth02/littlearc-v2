# VLT-04 Implementation Evidence

> **Status:** Complete within the recorded synthetic, staging-provider, physical-Android, and iOS-Simulator boundaries
> **Evidence date:** 2026-07-25
> **Last updated:** 2026-07-25
> **Owner:** Engineering
> **Milestone:** M3
> **Plan:** [VLT-04 plan](./vlt-04-file-encryption-and-resumable-upload-plan.md)
> **Research:** [VLT-04 research](./vlt-04-file-encryption-and-resumable-upload-research.md)
> **Decision:** [ADR-0015](../../adr/0015-encrypted-file-object-and-resumable-transport-boundary.md)
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)

---

## Outcome

VLT-04 is implemented and accepted within the bounded evidence below. A
synthetic VLT-03 capture asset can be sealed with upload-ready authenticated
encryption, uploaded in restart-safe multipart form, reconciled and resumed
without replaying an accepted part, integrity-checked as a complete ciphertext
object, downloaded only through current household/device authority, and
rejected before preview when its ciphertext or AAD is invalid.

The API stores only wrapped file-key material and encrypted-object metadata.
The provider-neutral storage package owns multipart and signed-URL behavior.
PostgreSQL enforces tenant, child, device, idempotency, and state boundaries.
SQLCipher V8 retains local upload/part state without retaining signed URLs.
The worker claims expired sessions through a least-authority cleanup operation
and isolates provider or persistence failure per claim.

Two final review defects were repaired before acceptance:

- create-session idempotency now serializes concurrent requests by session,
  compares every immutable request field including the plaintext file key by a
  timing-safe comparison, rejects changed replays, and aborts a redundant
  provider multipart upload; and
- cleanup timer, provider-abort, and finish failures are contained and logged
  with safe stable codes so one expired session cannot skip later claims or
  become an unhandled timer rejection.

`uploaded` means that encrypted bytes passed size and full SHA-256 verification.
It does not mean safe, parsed, malware-scanned, OCR-ready, record-linked, or
searchable. Those states remain in `VLT-05+`.

## Implemented Boundary

- AES-256-GCM file encryption with canonical household/object/purpose/format
  AAD, independent random DEKs, atomic legacy-AAD reseal, versioned key
  wrapping, and explicit transient-buffer clearing.
- SQLCipher V8 local upload/session/part persistence, bounded part cache files,
  restart reconciliation, retry/cancel states, verified download/import, and
  foreground preview cleanup.
- Reviewed PostgreSQL migration `0006_vlt_04_file_upload` with
  tenant-owned `file_objects` and `upload_sessions`, RLS/BOLA, append-only
  audit, idempotency, safe state transitions, and opaque worker cleanup claims.
- Provider-neutral fake and S3-compatible storage adapters supporting
  initiate, sign, list, complete, abort, head, full stream hash, signed
  download, and delete.
- `/v1/files` contracts and API lifecycle for create, part URL, reconcile,
  complete, cancel, status, and authorized download.
- Default-off `UPLOADS_ENABLED` kill switch and readiness failure when enabled
  storage is unhealthy.
- Production capture UI states for queued, uploading, retrying, failed,
  cancelled, and uploaded-pending-validation.
- Development-only synthetic device orchestration excluded from Android and
  iOS release exports.

## Automated And Database Evidence

The following checks passed with Node.js 26.4.0 and pnpm 11.14.0:

```sh
pnpm test:unit
pnpm test:contract
pnpm typecheck
pnpm test:database:record
pnpm test:database:rls
pnpm check:workspace
pnpm check:format
pnpm check:docs
pnpm build
pnpm validate
pnpm --filter @littlearc/mobile exec expo-doctor
pnpm --filter @littlearc/mobile run native:prebuild
cd apps/mobile/android &&
  ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
cd apps/mobile/ios &&
  xcodebuild -workspace LittleArc.xcworkspace -scheme LittleArc \
    -configuration Debug -sdk iphonesimulator \
    -destination 'id=7C8183EE-08E8-4F3D-A064-D3C404A10CC9' \
    CODE_SIGNING_ALLOWED=NO build
./tooling/validate-clean-checkout.sh
git diff --check
```

Focused results:

| Surface | Result |
| --- | --- |
| API | 3 files and 24 tests passed, including changed replay and redundant-provider cleanup |
| Worker | 4 tests passed, including per-claim abort/finish failure isolation |
| Observability | 5 files and 17 tests passed, including the safe cleanup-failure event |
| Storage | Fake/S3 multipart state, configuration, and bounded transport tests passed |
| Crypto | File AAD, key wrapping, tamper, and authenticated-decryption tests passed |
| Mobile | 66 local-security, upload-repository/orchestrator, capture, and UI-policy tests passed |
| Contracts | 2 files and 15 compatibility/schema tests passed |
| PostgreSQL upload integration | Concurrent exact replay, changed metadata/key rejection, multipart reconciliation, digest, tenant/revocation, metadata-only storage, and least-authority cleanup passed |
| PostgreSQL RLS | Gate 1 no-context, tenant visibility, blocked update, and SQLSTATE `42501` insert proof passed |
| Release containment | Android 29-file and iOS 25-file exports contain no synthetic validation route or header canary |
| Expo Doctor | 20 of 20 checks passed |
| Native prebuild | Clean Android/iOS generation and CocoaPods installation passed |
| Android native build | Pixel-target arm64 debug APK passed 615 tasks |
| iOS native build | Clean iPhone 17 Pro Simulator build passed all 165 targets; dependency warnings only |
| Clean checkout | Source-only snapshot and uncached workspace typechecks passed |

The database integration uses disposable local Aiven PostgreSQL and the
deterministic fake provider. It does not combine an Aiven database with Railway
object storage.

## Railway Staging Evidence

Only the `staging` environment was changed. Production has no service instances
and was not configured or deployed.

- Migration `0006_vlt_04_file_upload` exists in hosted staging PostgreSQL with
  the expected generated checksum.
- API and worker use the existing `littlearc-documents-staging` bucket through
  Railway variable references; no credential value is committed or printed.
- The synthetic provider probe passed multipart initiate, signed part upload,
  list/reconcile, complete, head, full-object SHA-256, signed download, repeated
  abort, delete, and final empty-bucket cleanup.
- API readiness passed with uploads enabled and configured storage healthy.
- The final remediation deployments were:
  - API: `74266165-d505-4179-b4c0-38f1bd8b51d8`
  - Worker: `0d7600b0-c0bf-43d4-8343-2c8b8ec3c5cc`

The direct staging probe is provider and hosted-configuration evidence. It is
kept separate from the local device orchestration below.

## Physical Pixel 8 Evidence

| Fact | Observed value |
| --- | --- |
| Device | Google Pixel 8 |
| ADB serial | `3A110DLJH000U7` |
| Android | 17 |
| Security patch | 2026-07-05 |
| Local schema | SQLCipher V8 |
| Data | Generated synthetic bytes only |
| API/provider | Disposable local Aiven plus in-memory multipart provider |

After the physical fingerprint prompt was completed, the Pixel passed the
development-only encrypted upload flow:

1. protected local enrollment and keyed SQLCipher V8 reopen;
2. encryption of a synthetic file larger than 5 MiB into a two-part upload;
3. forced failure after provider acceptance of part 1;
4. persisted failure/part state and resume without replaying part 1;
5. verified completion and authorized encrypted download;
6. rejection of a tampered download before preview; and
7. PostgreSQL file/audit evidence checks.

The rendered result was:

`VLT-04 device validation passed · SQLCipher V8 · 2-part encrypted upload ·
interrupted after part 1 · resumed without replay · authenticated download ·
tamper rejected`.

A package-scoped Android log scan found none of the synthetic filename, file-key,
wrapped-key, object-key, or validation payload canaries. Temporary ADB reverse
rules added for the proof were removed; unrelated existing rules were
preserved.

## iOS Simulator Evidence

| Fact | Observed value |
| --- | --- |
| Device | iPhone 17 Pro Simulator |
| Runtime | iOS 26.5 |
| UDID | `7C8183EE-08E8-4F3D-A064-D3C404A10CC9` |
| Local schema | SQLCipher V8 |
| Data | Generated synthetic bytes only |
| API/provider | Disposable local Aiven plus in-memory multipart provider |

The Simulator independently passed the same SQLCipher V8, forced second-part
failure, saved-part resume, authenticated download, and tamper-rejection flow.
The route rendered successfully through the LAN Metro connection after the
temporary server state was reset between target runs.

This is iOS-Simulator functional parity, not physical-iOS or Secure Enclave
evidence.

## Evidence Boundary And Deferred Work

Acceptance uses layered evidence on purpose:

- local automated and device flows prove client encryption, SQLCipher state,
  multipart interruption/resume, authorized download handling, and tamper
  rejection against generated data;
- disposable Aiven proves real PostgreSQL authorization, RLS, idempotency,
  state, audit, and cleanup behavior with the fake provider; and
- the complete Railway staging stack proves the real provider adapter,
  migration/configuration, health, multipart lifecycle, digest, download, and
  cleanup behavior.

The device routes were not pointed at Railway staging and are not described as
full-stack staging-device evidence. This separation avoids adding a synthetic
authentication bypass to the deployed API and avoids combining local Aiven
with Railway storage.

This evidence does not:

- close Gate 2 or authorize `VLT-05` or later M3 work;
- prove physical iOS, a second physical device, OS biometric-set mutation,
  low-end Android performance, or the complete TalkBack/VoiceOver matrix;
- authorize production object storage, a production deployment, signed pilot
  distribution, or real child/medical data;
- prove native background transfer while the app is suspended; or
- claim document validation, malware safety, OCR readiness, record linkage, or
  complete Vault search.

Those obligations remain in their named Gate 2, pre-pilot, production, or
later-work-package boundaries rather than being silently closed by VLT-04.

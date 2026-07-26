# VLT-05 Deferred Validation And Capability Closure Plan

> **Status:** Active follow-up plan; local ClamAV, bounded HEIC decode, and
> staging-enabled encrypted server previews are complete, while the full-stack
> identity boundary remains gated below
> **Plan date:** 2026-07-26
> **Last updated:** 2026-07-26
> **Owner:** Engineering
> **Milestone:** M3
> **Parent package:** [`VLT-05`](./vlt-05-worker-side-file-validation-plan.md)
> **Decision:** [ADR-0016](../../adr/0016-worker-file-validation-and-plaintext-cleanup-boundary.md)

---

## 1. Purpose

This plan gives every VLT-05 evidence deferral a named owner, execution point,
and closure test. It does not reopen the accepted VLT-05 package or change its
completion status. It separates:

1. a missing local provider integration check that can close now;
2. HEIC decode capability that must close before HEIC can become worker-ready;
3. optional server preview derivation that should arrive with its first Vault
   consumer; and
4. a complete authenticated mobile-to-staging-worker lifecycle that needs a
   safe staging identity boundary.

Gate 2 remains open. Production, real data, `VLT-06+`, and any authentication
bypass remain unauthorized. Preview processing is authorized only in staging.

## 2. Confirmed Current State

- The committed worker implements a provider-neutral clamd `INSTREAM` adapter,
  readiness policy, bounded stream, timeout, safe result mapping, and unit
  tests.
- A private Railway staging ClamAV deployment already proves the real scanner
  protocol, current signatures, benign/EICAR outcomes, and cleanup.
- Docker and Docker Desktop are not installed on the current Mac. Homebrew is
  available, and official ClamAV documentation supports `brew install clamav`.
- The local ClamAV integration command now exists and passed through the
  production scanner adapter.
- HEIC now requires a bounded top-level ISO-BMFF policy and complete
  single-primary-image pixel decode through the exact pinned worker image.
- Sharp's standard prebuilt binaries do not advertise HEIC input. HEIC requires
  a custom libvips build with libheif, libde265, and x265 support.
- F3 now provides the staging-enabled renderer, derivative table/object, queue,
  ciphertext-only grant route, local/Aiven validation, and Railway staging
  probe recorded in its implementation evidence.
- The current mobile development validation route targets a disposable local
  Aiven database and fake object store. It is excluded from release bundles.
- Staging intentionally has no synthetic authentication or household-bootstrap
  bypass. The existing synthetic adult-verification path is restricted to
  `APP_ENV=local`.

## 3. Closure Schedule

| Follow-up | State | Owner | Execution point | Closure trigger |
| --- | --- | --- | --- | --- |
| `VLT-05-F1` local ClamAV adapter integration | `COMPLETE` | Engineering | Completed 2026-07-26 under accepted VLT-05 validation scope | Homebrew clamd passed readiness, benign, EICAR, oversize, unavailable, and cleanup checks through the production adapter |
| `VLT-05-F2` bounded HEIC decode | `COMPLETE` | Engineering | Completed 2026-07-26 under separate founder authorization | Exact custom worker image/codecs, full decode, still-image policy, hostile fixtures, resource caps, cleanup, local integration, and Railway staging probe passed |
| `VLT-05-F3` encrypted server preview | `COMPLETE` | Engineering + founder/product | Completed 2026-07-26 under separate founder authorization | [Implementation and staging enablement evidence](./vlt-05-f3-implementation-evidence.md) passed with production untouched |
| `VLT-05-F4` authenticated mobile-to-staging-worker lifecycle | `BLOCKED` | Founder + engineering | Before `VLT-06` full-stack staging acceptance; no later than Gate 3 | Organization-owned synthetic test identity/inbox or an accepted ephemeral harness is available without a durable auth bypass |

The ADR-0016 calendar review remains 2026-10-25, but the earlier execution
points above take precedence when their feature is proposed.

## 4. VLT-05-F1 Local ClamAV Integration

### Scope

- Install the stable Homebrew ClamAV package on the development Mac.
- Use a task-scoped temporary configuration and signature directory; do not
  enable a persistent background service.
- Add a deterministic integration entry point that connects to an explicitly
  configured local clamd instance.
- Generate benign and EICAR bytes at runtime.
- Exercise the production `createClamdScanner` adapter, not `clamscan`.
- Emit only generic pass/fail output.
- Stop clamd and remove the temporary directory after the check.

### Non-goals

- Docker installation or Docker Desktop licensing.
- A production dependency or daemon.
- A persistent launch service.
- Real documents, filenames in evidence, or scanner signature names in logs.
- Replacing the accepted private Railway staging evidence.

### Files

- `apps/worker/integration/clamav.ts`
- `apps/worker/package.json`
- `package.json`
- VLT-05 plan/evidence and focused documentation indexes after validation

### Validation

```sh
pnpm test:integration:clamav
pnpm --filter @littlearc/worker test
pnpm --filter @littlearc/worker typecheck
pnpm check:format
pnpm check:docs
git diff --check
```

### Acceptance

- Readiness reports `ready` using a current observed signature version.
- Generated benign bytes return `clean`.
- Runtime-generated EICAR bytes return `detected`.
- The adapter rejects bytes beyond its client-side maximum.
- An unavailable daemon maps to a safe unavailable result.
- No persistent service, fixture, plaintext, or temporary signature directory
  remains after validation.

### Result

`VLT-05-F1` passed on 2026-07-26 with Homebrew ClamAV 1.5.3. The production
adapter reported ready against freshly downloaded signatures, returned clean
for generated benign bytes, detected the runtime-generated EICAR test string,
enforced the client stream bound, mapped a stopped daemon to retryable
unavailable, and removed its task-scoped workspace. clamd was stopped and no
Homebrew background service was enabled.

## 5. VLT-05-F2 Bounded HEIC Decode

HEIC enablement is a worker-runtime and supply-chain change, not a parser flag.

### Architecture

- Build a dedicated, digest-pinned worker image rather than relying on Railpack
  auto-detection for native codec availability.
- Pin Sharp and custom libvips plus libheif, libde265, and x265 versions and
  record licenses/advisories.
- Run HEIC decoding in the existing opaque workspace through a credential-free
  child process with the same no-new-privileges, CPU, memory, descriptor,
  process-count, output, and wall-clock limits used for hostile PDF tooling.
- Reject AVIF, sequences, animation, multiple images, auxiliary external data,
  unsupported bit depth/channels, over-dimension/pixel inputs, warnings,
  truncated data, and trailing payloads.
- Require a complete pixel decode into a bounded sink. Metadata inspection alone
  is not acceptance.
- Keep `unsupported_format` as the rollback behavior.

### Required evidence

- Generated benign HEIC fixtures from at least two independent encoders.
- Truncated, malformed-box, AVIF-brand, sequence, oversized-dimension,
  decompression-bomb, timeout, crash, and cancellation fixtures.
- Exact local Linux-image and Railway staging capability probes.
- Workspace/key cleanup after success, rejection, timeout, cancellation, and
  process termination.
- No raw decoder error, metadata, filename, or content in operational logs.

### Authorization and result

The founder accepted this follow-up plan and separately authorized bounded F2
implementation and synthetic local/Railway-staging validation on 2026-07-26.
The resulting worker image originally pinned Sharp 0.34.5 and libvips 8.17.3.
The required supply-chain remediation for `GHSA-f88m-g3jw-g9cj` now pins Node
26.4.0 by digest, Sharp 0.35.3, libvips 8.18.3, libheif 1.15.1, libde265
1.0.11, and x265 3.5. The decoder:

- accepts only a single HEVC-compressed HEIF image after strict top-level
  `ftyp`/`meta`/`mdat` policy;
- performs complete raw-pixel decode in a credential-free child;
- uses no-new-privileges, a 30-second CPU/wall envelope, 256 MiB V8 old-space,
  16 MiB semi-space, 4 GiB virtual address-space ceiling, 16 MiB file output,
  64 descriptors, and 64 processes under isolated UID 55105;
- disables libvips caching, holds concurrency and OpenMP to one, and uses a
  minimal libvips build with HEIF as its only external image format;
- rejects AVIF, sequences, malformed/truncated/trailing data, unsupported
  depth/channel/page structure, over-dimension/pixel input, crashes, timeouts,
  and cancellation through safe outcomes; and
- keeps preview derivation disabled.

Local validation used two synthetic encoders. Railway deployment
`6b455ef2-bef9-4dc6-8780-4ec064eb4455` passed an exact-package/image probe and
full sandboxed decode of a 2-by-2 fixture generated during the pinned Linux
image build. This completion does not authorize `VLT-06`.

## 6. VLT-05-F3 Safe Server Preview

Server preview remains deferred to `VLT-08` because the current mobile capture
flow already creates an independently encrypted local thumbnail, while no
remote Vault consumer exists for a server derivative.

The founder authorized preparation of the dedicated
[VLT-05-F3 proposed plan](./vlt-05-f3-encrypted-server-previews-plan.md) on
26 July 2026. Plan preparation does not authorize implementation or flag
enablement.

When triggered:

- add a reviewed forward migration for immutable derivative facts;
- render only after the original is structurally valid and malware-clean;
- support one image frame or PDF page 1 only;
- run image/PDF rendering in a credential-free bounded process;
- re-encode to a maximum 1600-pixel JPEG, quality 82, at most 1 MiB;
- remove EXIF, XMP, IPTC, ICC, PDF text, annotations, links, and source names;
- encrypt with a new DEK and derivative-specific AAD before object storage;
- expose only a separately authorized household-scoped download route;
- keep preview failure independent from original validation; and
- prove cleanup before `preview_state=ready`.

`FILE_PREVIEWS_ENABLED` stays `false` in local, staging, and production until
that implementation plan is reviewed and staging capability evidence passes.

## 7. VLT-05-F4 Full Authenticated Mobile-To-Staging Lifecycle

### Blocker

The deployed API correctly requires Better Auth identity and household/device
authority. The development-only synthetic route is excluded from release
bundles, and staging rejects the local-only synthetic adult-verification mode.
Reintroducing a durable header/session bypass would weaken the exact boundary
this evidence is meant to prove.

### Approved approaches

Use one of:

1. an organization-owned synthetic email inbox and normal staging
   authentication/onboarding flow; or
2. a separately reviewed, time-bounded staging harness deployed from a distinct
   service/config, disabled by default, inaccessible from production, and
   removed after evidence.

Do not seed a durable session token, log an OTP, reuse the development
`x-littlearc-synthetic-session` header, or accept a participant/personal email.

### Lifecycle evidence

Using generated JPEG and static PDF bytes only:

1. authenticate through the accepted staging identity path;
2. create an authorized synthetic household/child/device;
3. encrypt on the mobile client and upload through staging HTTPS/object storage;
4. observe minimized queue dispatch and worker claim;
5. reach `ready` after structure, malware, and cleanup;
6. observe safe status on the authenticated mobile client;
7. exercise interruption/resume and one rejected hostile fixture;
8. verify no identifiers/content in API, worker, scanner, database/job, or
   evidence logs; and
9. delete the synthetic account, household rows, jobs, ciphertext, multipart
   state, and temporary mobile material.

Physical-device proof remains separate from this full-stack staging lifecycle
unless the selected execution explicitly includes it.

## 8. Risks And Rollback

| Risk | Control |
| --- | --- |
| Local package mistaken for runtime dependency | Keep Homebrew ClamAV outside application manifests |
| HEIC native codec drift | Dedicated pinned image plus startup/staging format probe |
| Patent/license obligations | Founder review of libheif/libde265/x265 licensing before image adoption |
| Preview expands plaintext/storage surface | Defer to a real VLT-08 consumer and require fresh encryption/cleanup |
| Staging validation creates an auth bypass | Normal synthetic identity or isolated ephemeral harness only |
| Follow-up evidence overclaims Gate 2/production | Keep synthetic staging, device, Gate 2, and production evidence separate |

## 9. Plan Acceptance Criteria

- Every prior VLT-05 deferral has a named owner, execution point, trigger,
  implementation boundary, and closure evidence.
- Local ClamAV is closed independently from Railway staging evidence.
- HEIC is accepted only through the exact bounded worker decoder; removing or
  failing its startup capability returns to safe rejection.
- Preview remains off until its VLT-08 consumer and separate authorization.
- Full staging lifecycle never adds a durable synthetic authentication bypass.
- Production and real-data boundaries remain unchanged.

## 10. Primary References

- [ClamAV macOS package installation](https://docs.clamav.net/manual/Installing/Packages.html)
- [ClamAV clamd protocol and `INSTREAM`](https://docs.clamav.net/manual/Usage/ClamdProtocol.html)
- [Sharp installation and custom libvips requirements](https://sharp.pixelplumbing.com/install/)
- [Sharp runtime format and operation controls](https://sharp.pixelplumbing.com/api-utility/)

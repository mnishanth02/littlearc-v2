# VLT-05 Worker-Side File Validation Plan

> **Status:** Accepted and implemented within the linked synthetic local-Aiven
> and Railway-staging evidence boundary
> **Plan state:** Founder-reviewed and separately authorized on 2026-07-25;
> bounded HEIC follow-up separately authorized and completed on 2026-07-26;
> previews, production, real data, Gate 2 closure, and VLT-06+ remain unauthorized
> **Created:** 2026-07-25
> **Last updated:** 2026-07-26
> **Owner:** Engineering
> **Milestone:** M3
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
> **Roadmap:** [M3 Vault Wedge](../roadmap.md#m3--vault-wedge)
> **Predecessor plan:** [VLT-04 file encryption and resumable upload](./vlt-04-file-encryption-and-resumable-upload-plan.md)
> **Predecessor evidence:** [VLT-04 implementation evidence](./vlt-04-implementation-evidence.md)
> **Implementation evidence:** [VLT-05 implementation evidence](./vlt-05-implementation-evidence.md)

---

## 1. Outcome

VLT-05 will turn an integrity-checked encrypted `file_object` from VLT-04 into
a safely classified worker result. The worker will:

1. claim one durable validation job without receiving a child ID or filename in
   the queue payload;
2. obtain only the claimed object's bounded decryption and storage material;
3. download and authenticate the ciphertext;
4. decrypt into a private, opaque, leased temporary workspace;
5. re-detect MIME from bytes and strictly validate the complete file structure;
6. apply bounded, conservative PDF rules;
7. require an authorized malware-scanner result;
8. optionally derive a metadata-free encrypted raster preview when that
   capability is separately enabled;
9. remove all plaintext and working material before committing a terminal
   validation state; and
10. expose only safe status codes and aggregate operational telemetry.

`ready` will mean that the original matched an allowed type, passed strict
structure checks, contained none of the prohibited PDF capabilities, and
received a current clean malware scan. It will not mean that the document is
clinically correct, OCR-reviewed, linked to a record, searchable, suitable for
real data, or safe against every unknown threat.

## 2. Authorization And Delivery Boundary

The founder reviewed and accepted this plan and separately authorized bounded
VLT-05 implementation and validation on 2026-07-25. The authorization remains:

- synthetic-only;
- staging-only for hosted provider validation;
- production-disabled;
- separate from real child, household, participant, or medical document data;
- separate from physical-iOS, two-device, low-end-Android, full
  assistive-technology, pilot, and real-data claims; and
- limited to VLT-05 rather than implicitly authorizing OCR, extraction, record
  linkage, Vault search, or later M3 packages.

Gate 2 remains open. This package-specific exception does not authorize
`VLT-06+`, production, real data, previews, pilot claims, or any broader M3
work.

## 3. Roadmap Scope

The package-scope source is roadmap Section 12.1:

- recheck magic-byte MIME and file structure;
- bound PDF parsing and reject active/executable content;
- add malware scanning and safe preview derivation when authorized;
- guarantee plaintext cleanup through terminal and failure paths; and
- record operational state without filenames or document content.

The plan interprets "when authorized" as two separate runtime capabilities:

- malware scanning is mandatory before a file may become `ready`; and
- server-derived previews are optional and controlled by a distinct
  authorization switch.

Disabling preview derivation must not weaken core validation. Disabling or
misconfiguring malware scanning must fail closed and prevent `ready`.

## 4. Scope

### 4.1 Durable Validation Dispatch

- Activate the already pinned `pg-boss@12.26.1` dependency without changing its
  version.
- Insert a minimized `file_validation_requested` outbox event in the same
  PostgreSQL transaction that creates the VLT-04 `file_objects` row.
- Dispatch that event to a versioned `file-validation-v1` queue with a
  deterministic job identity.
- Use a dead-letter queue, bounded retry/backoff, job expiry, graceful
  shutdown, and stale-lease recovery.
- Keep the queue payload to one opaque `fileObjectId`. Do not include a
  household ID, child ID, filename, object-storage key, MIME, key material,
  digest, URL, or document metadata.

### 4.2 Worker Validation

- Reverify ciphertext byte count, SHA-256, authenticated AAD, and GCM tag before
  a parser sees plaintext.
- Detect type from content signatures, compare it with the declared canonical
  MIME, and route only the accepted JPEG, PNG, HEIC/HEIF, and PDF formats.
- Apply complete format-specific structure checks rather than treating a
  leading signature as proof of validity.
- Reject malformed, truncated, ambiguous, polyglot, encrypted/password-protected,
  unsupported, over-limit, or active-content inputs with stable safe codes.
- Scan the authenticated plaintext through a provider-neutral malware boundary.
- Persist only the bounded outcome and non-identifying operational facts.

### 4.3 Optional Safe Preview

- Derive at most one first-page/first-frame raster preview only after core
  structure validation and a clean malware result.
- Decode/render with explicit time, memory, dimension, page, and output limits.
- Re-encode to a fixed raster format with metadata stripped.
- Encrypt the derivative with a new DEK and derivative-specific AAD before
  object storage.
- Keep preview processing disabled unless the separate preview switch and
  deployment prerequisites are authorized.

### 4.4 Cleanup And Recovery

- Use one opaque leased workspace per validation attempt.
- Use restrictive permissions and never derive paths from user data.
- Remove plaintext in a `finally` path on success, rejection, retryable failure,
  cancellation, and graceful shutdown.
- Recover from abrupt process/container failure with startup and periodic stale
  workspace scavenging plus database lease recovery.
- Do not commit `ready`, `rejected`, or terminal `failed` until the attempt
  workspace has been removed successfully.

## 5. Non-Goals

- On-device OCR, cloud extraction, suggestions, consented AI, or review
  (`VLT-06`).
- Record creation, correction, attachment linkage, or `record_file_links`.
- Vault search, ranking, filters, duplicate-document UX, reminders, or Timeline
  behavior.
- Content disarm and reconstruction of the original PDF.
- Rewriting or replacing the parent-uploaded encrypted original.
- Serving a server-rendered interactive PDF.
- Supporting Office documents, archives, SVG, TIFF, GIF, video, audio, or
  arbitrary HEIF sequences.
- Legal or clinical adjudication of document content.
- A claim that malware scanning proves an object contains no malware.
- Production ClamAV/provider provisioning, production deployment, real-data
  processing, or pilot rollout.
- Native mobile capture/import changes or device acceptance evidence.
- Dependency upgrades unrelated to the minimum VLT-05 implementation.

## 6. Context Selected

The planning review intentionally used the smallest relevant set:

- `docs/IMPLEMENTATION_STATUS.md`;
- `docs/index.md`;
- roadmap Section 12 and the M3 index;
- the VLT-04 plan, research, evidence, migration, ADR-0015, and implemented
  upload/storage/worker boundaries;
- architecture Sections 7, 11, 15, 16, and 20;
- backend data-model Sections 13, 15, 16, 20 through 24, 26, and 31;
- ADR-0005 for PostgreSQL/RLS/`pg-boss`;
- worker, API, and shared-package `AGENTS.md` files;
- data-classification, migration, testing, environment, and staging-release
  references;
- existing worker, API, storage, crypto, database, contracts, observability,
  domain, Railway, and validation code/tests; and
- current primary documentation listed in Section 28.

`./scripts/context/find-context.sh "VLT-05 worker-side file validation"` matched
the `vault-records` and `mobile` domains. The worktree was clean before this
plan was created.

## 7. Confirmed Facts

1. VLT-04 stores encrypted originals under opaque object keys and independently
   verifies completed ciphertext byte count and SHA-256.
2. VLT-04 stores a wrapped file DEK, content nonce/tag, AAD version, declared
   MIME, ciphertext metadata, household relationship, and child relationship in
   PostgreSQL.
3. `file_objects.validation_state` currently permits only `pending`.
4. `uploaded` and `pending` do not imply parsed, malware-scanned, OCR-ready,
   record-linked, or searchable.
5. The worker currently runs heartbeat and timer-based upload-expiry cleanup.
   It has no validation queue, no file decryption composition, and no parser or
   malware boundary.
6. `pg-boss@12.26.1` is already an exact worker dependency but is unused.
7. The accepted architecture selects PostgreSQL/`pg-boss`, not Redis or another
   hosted queue.
8. VLT-04's worker cleanup functions deliberately expose only opaque multipart
   cleanup identifiers and no key material.
9. The worker staging manifest already receives object-storage credentials,
   `DATABASE_URL`, and `KEY_WRAPPING_SECRET_V1`.
10. `@littlearc/storage` can hash, head, sign, and delete encrypted objects but
    does not yet expose worker streaming reads or derivative writes.
11. `@littlearc/crypto` can unwrap household and file keys but does not yet
    expose streaming authenticated file decryption or derivative encryption.
12. The accepted maximum original is 25 MB; PDF maximum is 50 pages.
13. The current accepted MIME contract is JPEG, PNG, HEIC, and PDF, while the
    architecture also names HEIF. The alias must be normalized deliberately.
14. Original filenames, document content, OCR text, storage keys, digests,
    ETags, URLs, provider responses, household IDs, and child data are
    prohibited from telemetry.
15. Local automated database work uses disposable Aiven PostgreSQL. It must not
    be mixed with Railway object storage.
16. Railway staging is synthetic-only; production provisioning remains
    deferred.
17. Android and iOS currently show an uploaded-pending-validation boundary.
    VLT-05 is server/worker work and does not require new native capability.

## 8. Assumptions

These assumptions require confirmation during plan review:

1. Static, unencrypted PDFs are sufficient for the MVP. Password-protected
   PDFs, portfolios, attachments, AcroForms, XFA, rich media, and action-bearing
   PDFs may be rejected conservatively.
2. A clean malware result is mandatory for `ready`, while a server preview is
   optional.
3. The worker may receive bounded key-unwrapping authority for one claimed file
   at a time because the accepted architecture already states that the worker
   decrypts for validation.
4. The original encrypted object remains immutable. Rejection changes state;
   it does not silently delete the device-local source or rewrite the original.
5. A rejected original may remain available only through the existing
   authenticated original-download boundary, but clients must not automatically
   render it or pass it to OCR/record-linking flows.
6. The existing `outbox_events` table remains the atomic handoff from upload
   completion; a new queue system is not introduced.
7. QPDF and MuPDF command-line tools can be installed in the Railway worker
   image at exact reviewed versions, and the environment supports the required
   process/resource controls. This must be proven before preview enablement.
8. A dedicated ClamAV service can be isolated on Railway private networking
   with no public domain or TCP proxy. This is acceptable for synthetic staging
   only pending security review.
9. Preview output can use fixed JPEG because it is widely decodable and the
   derivative is not the source of record.
10. Existing VLT-03 local thumbnails remain local capture UX; a VLT-05 server
    preview is a separate encrypted derivative for later authorized server
    flows.

## 9. Open Questions Requiring Decision

| Question | Why it matters | Proposed default |
| --- | --- | --- |
| Is VLT-05 implementation separately authorized before Gate 2 closes? | The current dashboard blocks `VLT-05+` | No; wait for explicit founder direction |
| Is server preview derivation authorized in the first VLT-05 increment? | It expands server plaintext processing and storage | Keep `FILE_PREVIEWS_ENABLED=false`; implement only after explicit approval |
| Is a private Railway ClamAV service acceptable for synthetic staging? | `clamd` TCP is unauthenticated and ClamAV needs substantial RAM | Permit only after a private-network and cost review; never expose publicly |
| Which ClamAV line is approved? | Patch cadence, signature compatibility, and memory affect operations | Pin the latest supported 1.4 LTS patch/digest at implementation review; currently 1.4.5 |
| Must digitally signed or form PDFs be accepted in MVP? | A conservative AcroForm/action rejection may reject legitimate documents | Reject in VLT-05; revisit only with a signed-PDF use case and new tests |
| May authenticated users redownload a rejected original? | Preserves user ownership but may expose a known-dangerous file to rendering | Preserve encrypted download only; block automatic preview/OCR/linking and show a safe status later |
| What is the approved temp-volume size and worker memory tier? | PDF parsing, malware signatures, and concurrent validation are resource-heavy | Concurrency 1 until measured; require at least two-file workspace headroom plus scanner capacity |
| Does Railway permit the intended subprocess sandbox controls? | Parser isolation must be verified, not assumed | Run a staging capability spike before enabling PDF preview |
| Is a new worker service split required for plaintext parsing? | A separate service can reduce credential blast radius but adds transport and operations | Keep one worker process initially; re-evaluate if sandboxing cannot be enforced |
| What retention applies to rejected originals and derivatives? | Current durations remain legally unapproved | Do not change retention in VLT-05; preserve current encrypted object until the retention package is approved |

Any answer that materially changes the trust boundary should update this plan
and may require a new ADR before implementation.

## 10. Current-State Findings

### 10.1 Upload And Object Boundary

VLT-04 creates a `file_objects` row only after provider completion and a full
ciphertext size/hash match. The row contains enough material to authenticate
and decrypt the original, but only the authenticated API path currently unwraps
the file DEK.

The object key is opaque and unrelated to a filename. It is sensitive
operational metadata and must stay inside storage/persistence adapters.

### 10.2 Worker Boundary

The worker runtime is timer-driven. Upload cleanup is carefully least-authority
and isolates each provider/persistence failure, but it is not a general job
runner. VLT-05 is the first package that must activate the accepted durable
queue design.

Worker shutdown currently clears timers and immediately closes the database.
Validation requires a drain sequence: stop intake, abort or finish active work,
clean attempt workspaces, stop `pg-boss`, then close storage/database resources.

### 10.3 Database And Queue Boundary

`outbox_events` already supports atomic domain-to-worker handoff, but its
current RLS policy prevents a tenant-neutral worker from reading arbitrary rows
directly. VLT-05 should follow the VLT-04 cleanup pattern: security-definer
functions claim only the named event and return a minimized payload.

Runtime `pg-boss` schema behavior has not been accepted as migration evidence.
The exact pinned package reports schema version 37. Queue schema installation
and queue creation must use a migration-capable credential in a reviewed
staging step; the normal worker credential must not receive general DDL
authority.

### 10.4 Crypto Boundary

The worker will require the same versioned KEK interface used by the API, but
should not gain general table reads. A security-definer claim should return
only:

- the claimed file-object ID;
- household ID required transiently for AAD;
- opaque storage key;
- ciphertext byte count and SHA-256;
- declared MIME;
- wrapped household key material and version;
- wrapped file-key material and version;
- content nonce/tag; and
- AAD version.

It must not return a child ID, membership ID, filename, record content, OCR
text, or unrelated household rows.

### 10.5 Contracts And Mobile Boundary

The current file projection always reports `validationState: "pending"`.
VLT-05 needs a safe state projection and polling/read boundary, but not a new
native module or capture adapter.

### 10.6 Observability Boundary

The safe logger is a positive allowlist. It currently accepts lifecycle and
upload-cleanup codes only. Validation codes must use bounded outcome/category,
duration, attempt count, and queue age. Dynamic exception messages, paths,
scanner signatures, parser output, and job payloads must never be logged.

## 11. Architecture Decisions

### D1. Preserve The Transactional Outbox

Upload completion will insert a `file_validation_requested` outbox event in the
same transaction as the `file_objects` row and audit event. The event payload
will be exactly:

```json
{ "fileObjectId": "opaque-uuidv7" }
```

A worker dispatcher claims only this event type through a security-definer
function, sends a deterministic `pg-boss` job, then marks the outbox event
dispatched. A crash between send and finish is safe because redispatch uses the
same job identity and verifies a duplicate before marking the event dispatched.

### D2. Use One Versioned Queue And One Dead-Letter Queue

Initial queue names:

- `file-validation-v1`;
- `file-validation-dead-v1`.

Proposed initial queue policy, to be measured in staging:

| Setting | Proposed value | Reason |
| --- | --- | --- |
| Policy | `standard` with `singletonKey=fileObjectId` | Prevent concurrent work for one immutable original |
| Worker concurrency | `1` | Bound plaintext and parser/scanner memory until measured |
| Retry limit | `5` | Recover transient storage/scanner/database failures without infinite work |
| Retry delay | `30 seconds` | Avoid immediate scanner/provider hammering |
| Exponential backoff | Enabled, capped at `15 minutes` | Bounded recovery under outages |
| Active expiry | `15 minutes` with heartbeat | Covers a 25 MB file while detecting hung work |
| Completed retention | `7 days` | Short operational diagnosis window; no document content in job data |
| Dead letter | After retry exhaustion | Requires safe operator redrive or rejection decision |

`pg-boss` delivery does not make business side effects exactly once. Every
database transition, derivative write, and cleanup action remains idempotent.

### D3. Separate Dispatch, Claim, And Terminal Commit

The job handler must:

1. claim the file and a new opaque attempt ID;
2. transition `queued -> validating` with a lease;
3. create the workspace only after the lease exists;
4. perform validation;
5. store a proposed safe result as nonterminal attempt state;
6. remove the workspace;
7. commit `ready`, `rejected`, or `failed` only after cleanup succeeds; and
8. acknowledge the queue job.

If the process dies before Step 7, stale-lease recovery cleans the workspace
and requeues the object. If it dies after Step 7 but before queue
acknowledgement, the retry sees the terminal state and exits idempotently.

### D4. Keep The Original Immutable

Validation never rewrites, sanitizes, or replaces the original ciphertext.
This preserves VLT-04 integrity, provenance, and device recovery. Rejected
files cannot enter OCR, preview, record-linking, or search workflows.

### D5. Use Layered Type Validation

A magic-byte detector is only a router. Acceptance requires all of:

- allowed detected type;
- canonical declared/detected MIME agreement;
- format-specific full-container validation;
- configured size/page/dimension limits;
- no unexplained trailing payload;
- no prohibited PDF capabilities; and
- a clean malware result.

The implementation may add exact `file-type@22.0.1` as the ESM-compatible
signature detector. It is a justified new direct dependency, not an upgrade,
and its own documentation explicitly describes detection as best-effort.
Strict JPEG/PNG/ISO-BMFF/PDF parsers remain authoritative.

### D6. Treat PDF As Static Page Content Only

VLT-05 accepts only unencrypted PDFs that QPDF parses without errors or
warnings, contain 1 through 50 pages, remain within object/resource limits, and
contain no prohibited active or embedded capability anywhere in reachable or
unreferenced objects.

The first implementation will reject:

- document encryption/password protection;
- `/JavaScript` and `/JS`;
- `/OpenAction` and `/AA`;
- `/Launch`, `/SubmitForm`, `/ImportData`, `/GoToR`, `/URI`, `/Rendition`, and
  other external/action dictionaries;
- `/EmbeddedFiles`, `/Filespec` with `/EF`, portfolios/collections, and file
  attachments;
- `/RichMedia`, `/Movie`, `/Sound`, `/3D`, and multimedia annotations;
- `/AcroForm` and `/XFA`;
- parser repairs/warnings, malformed xref/page trees, excessive objects or
  nesting, unsupported filters, and unexplained trailing content.

Internal static destinations may remain. The deny list must be implemented as a
typed recursive traversal over bounded QPDF JSON, not a byte-string search.

QPDF is a structural validator and object inspector, not a malware scanner or
semantic security oracle. The plan therefore keeps malware scanning and
raster-only preview as separate layers.

### D7. Run Hostile Parsers As Bounded Subprocesses

QPDF and MuPDF must run through `execFile`/`spawn` without a shell and with:

- fixed executable paths and fixed argument arrays;
- no user-controlled filenames or arguments;
- an opaque private working directory;
- a minimal environment;
- non-root UID/GID;
- `no_new_privs`;
- CPU, address-space, file-size, open-file, and process-count limits;
- bounded stdout/stderr capture;
- `AbortSignal`, wall-clock timeout, TERM grace, then KILL;
- concurrency one initially; and
- no parser output in logs.

If Railway cannot enforce the required resource/sandbox controls, PDF preview
enablement is blocked and the team must decide whether to split parsing into a
credential-free isolated service.

### D8. Make Malware Scanning Provider-Neutral And Mandatory

Define:

```text
MalwareScanner.scan(stream, limits) ->
  clean | detected | retryable_unavailable | permanent_error
```

The production handler depends only on this interface. A ClamAV adapter uses
`INSTREAM`, never sends a local path, caps the stream to the accepted plaintext
limit, uses timeouts, and maps raw signature/provider text to stable internal
codes without storing or logging it.

The adapter must verify scanner readiness, engine version policy, and signature
freshness before accepting a clean result. Scanner unavailable, stale
signatures, oversized response, timeout, protocol error, or ambiguous result
must not become clean.

### D9. Keep Preview Derivation Independent

Core validation may finish `ready` with `preview_state=not_authorized` when the
preview switch is off. When enabled:

- images decode through exact `sharp@0.35.3` with reviewed libvips `8.18.3`;
- input pixel/channel limits and strict failure behavior remain enabled;
- HEIC/HEIF support is verified in the deployed libvips build;
- PDFs render page 1 only through an exact reviewed MuPDF build with bounded
  dimensions/banding;
- all intermediates pass through Sharp and are re-encoded as a fixed
  maximum-1600-pixel JPEG, quality 82, with no EXIF, XMP, IPTC, ICC, filename,
  PDF annotation, link, text, or original metadata;
- output is capped at 1 MiB;
- the preview gets a fresh DEK and derivative-specific AAD;
- only encrypted bytes enter object storage; and
- a failed optional preview never downgrades a clean original to rejected.

The accepted implementation initially pinned `sharp@0.34.5`. The repository
supply-chain check later identified
[`GHSA-f88m-g3jw-g9cj`](https://github.com/advisories/GHSA-f88m-g3jw-g9cj),
which requires Sharp 0.35.0 or later. The bounded remediation therefore pins
`sharp@0.35.3` and its minimum compatible custom libvips `8.18.3`; the HEIC and
preview integration suites must pass before merge.

### D10. Make Cleanup A State-Machine Invariant

`finally` cleanup is necessary but insufficient because SIGKILL, OOM, host
failure, and container replacement bypass it. The invariant is:

> No validation attempt reaches a terminal business state while its leased
> workspace may still contain plaintext.

The worker will enforce this with:

- opaque attempt IDs;
- a dedicated temp root validated at startup;
- `0700` directories and `0600` files;
- atomic `.part` to fixed opaque-name promotion only after authenticated
  decryption completes;
- explicit close of every handle/stream/subprocess;
- recursive forced removal with bounded retries;
- a cleanup-pending safe state on deletion failure;
- graceful signal draining;
- startup scavenging before queue intake;
- periodic scavenging of expired leases;
- stale database lease recovery only after workspace cleanup; and
- readiness failure if the temp root is unsafe, unwritable, persistent when
  forbidden, or cannot be scavenged.

### D11. Keep Logs Aggregate And Content-Free

Logs may include only:

- stable event code;
- environment, service, version, severity, and timestamp;
- queue job ID or attempt ID when operationally essential;
- outcome category;
- bounded duration;
- retry/attempt number;
- queue age bucket; and
- cleanup result.

Logs must not include:

- filenames or file extensions;
- local paths or temp-root paths;
- declared/detected MIME per object;
- object key, storage URL, digest, ETag, nonce/tag, wrapped/plaintext key;
- file-object, household, child, membership, user, record, or provider IDs;
- PDF object values, action names found in a particular document, page text, or
  parser/scanner raw output;
- malware signature names;
- exception messages or stack fields containing dynamic paths/content; or
- plaintext leakage canaries.

Per-object state belongs in PostgreSQL behind authorization, not telemetry.

## 12. File Validation Pipeline

### 12.1 Ordered Stages

| Stage | Work | Success output | Failure class |
| --- | --- | --- | --- |
| 0. Dispatch | Outbox event becomes deterministic queue job | `queued` | Retryable infrastructure |
| 1. Claim | Acquire file lease and bounded decryption material | Attempt lease | No-op if terminal; retry conflict |
| 2. Workspace | Create opaque private directory | Empty leased workspace | Retryable filesystem |
| 3. Ciphertext read | Stream provider bytes, recompute size/SHA-256 | Verified ciphertext temp or stream | Terminal integrity rejection |
| 4. Authenticated decrypt | Unwrap keys, stream AES-GCM, call `final`, zero keys | Complete plaintext `.part` promoted to `input.bin` | Terminal authentication rejection |
| 5. Signature detect | Read bounded signature window | Canonical detected MIME | Terminal unsupported/mismatch |
| 6. Structure validate | Consume complete JPEG/PNG/HEIF/PDF structure | Normalized safe metadata | Terminal malformed/limit/polyglot |
| 7. PDF policy | QPDF check, page/object limits, recursive capability scan | Static PDF classification | Terminal active/encrypted/malformed |
| 8. Malware scan | Stream plaintext through authorized scanner | Clean engine/signature result | Detected terminal; unavailable retryable |
| 9. Preview | Optional first-frame/page raster re-encode | Encrypted preview object | Independent retryable/failed preview |
| 10. Proposed result | Persist safe nonterminal outcome | `result_pending_cleanup` | Retryable database |
| 11. Cleanup | Close and remove every attempt artifact | Workspace absent | Retryable cleanup; readiness alert |
| 12. Commit | Persist terminal state and safe audit event | `ready`, `rejected`, or `failed` | Retryable database/idempotent replay |
| 13. Ack | Complete queue job | Retained bounded job fact | Idempotent retry |

### 12.2 MIME And Structure Rules

#### JPEG

- Require an allowed JPEG signature and a structurally valid marker stream.
- Enforce one image, bounded dimensions/pixels/channels, valid segment lengths,
  successful strict decode, terminal EOI, and no unexplained trailing bytes.
- Reject truncated, multi-payload, unsupported color/decode, or dimension-bomb
  inputs.

#### PNG

- Require the PNG signature, valid chunk order/length/CRC, exactly one IHDR and
  IEND, bounded dimensions/decompressed pixels/channels, successful strict
  decode, and no bytes after IEND.
- Reject unknown critical chunks, malformed compressed streams, animated APNG
  in the first increment, or decompression-limit violations.

#### HEIC/HEIF

- Parse the complete ISO-BMFF box layout with checked 64-bit arithmetic and
  bounded nesting.
- Require an allowlisted still-image HEIC/HEIF brand and reject AVIF, sequences,
  animation, external data references, malformed boxes, or trailing payloads.
- Normalize accepted `image/heif` to the current contract's canonical
  `image/heic` only after container and strict decode checks.
- Verify deployed libvips HEIF decoding before enabling this format in staging;
  otherwise fail closed with a safe unsupported code.

#### PDF

- Apply Section 13 in addition to general size and malware rules.

### 12.3 Safe Error Taxonomy

Exact names may be refined during review, but categories must remain stable:

```text
type_mismatch
unsupported_format
malformed_structure
resource_limit_exceeded
ciphertext_integrity_mismatch
authenticated_decryption_failed
pdf_encrypted
pdf_active_content
pdf_embedded_content
malware_detected
scanner_unavailable
scanner_signatures_stale
preview_failed
plaintext_cleanup_retry
validation_retry_exhausted
```

No safe code reveals a filename, PDF action value, malware family/signature,
household, child, or document content.

## 13. PDF Safety Strategy

### 13.1 Parser Selection

Use a reviewed exact QPDF build for structural checking and JSON object
inspection. The planning baseline is QPDF 12.3.2 or a later stable patch
explicitly re-reviewed at implementation time. Do not install an unpinned
floating system version.

QPDF commands must:

- inspect without repairing or rewriting the original;
- omit stream data from JSON;
- cap JSON output;
- fail on warnings as well as hard errors;
- report page count and object structure;
- include unreferenced objects in the prohibited-capability traversal; and
- execute within the subprocess limits in D7.

### 13.2 Resource Bounds

Initial limits:

- ciphertext/plaintext: current 25 MB boundary plus authenticated-format
  overhead already accepted by VLT-04;
- pages: 1 through 50;
- object count: 100,000 maximum, lowered if staging evidence supports it;
- recursive traversal depth: 64;
- JSON output: 16 MiB;
- structural check wall time: 30 seconds;
- address space: 512 MiB;
- output files: none for core validation;
- parser processes per worker: one.

Limits are configuration with safe compiled maxima. Environment values may
lower but never exceed compiled maxima without a reviewed plan change.

### 13.3 Prohibited Capability Traversal

Do not grep raw PDF bytes. Parse QPDF JSON and recursively inspect every
dictionary, array, stream dictionary, trailer, referenced object, and
unreferenced object with cycle and depth protection.

A prohibited name/value anywhere produces the generic
`pdf_active_content` or `pdf_embedded_content` result. Raw keys and values are
not retained in logs, audit, analytics, job output, or user-facing errors.

### 13.4 Preview Rendering

When preview authorization is off, no PDF renderer runs.

When on, render page 1 only after structure validation and clean malware scan.
Use a reviewed exact MuPDF release in a bounded subprocess. Produce an
intermediate PNG with width/height capped at 1600 and banded rendering, then
strictly re-decode/re-encode through Sharp to the final metadata-free JPEG.
Delete both intermediate plaintext files before terminal commit.

Rendering success does not weaken or replace the QPDF capability checks.

## 14. Malware Scanning Strategy

### 14.1 Provider Interface

The adapter accepts a bounded readable stream and an abort signal. It returns
only:

```text
clean
detected
retryable_unavailable
permanent_error
```

The adapter may expose engine version, signature timestamp/serial, duration,
and bytes scanned to in-memory policy code. Only aggregate version/freshness
metrics may be emitted; per-file signature/provider text is discarded.

### 14.2 ClamAV Baseline

The proposed first provider is official ClamAV:

- use the current supported 1.4 LTS patch and pin the deployment image by
  immutable digest after review;
- use official `freshclam` signature updates;
- require successful `PING`, a supported engine, and signatures no older than
  the approved threshold before accepting jobs;
- use `INSTREAM` with chunk and total limits;
- set `StreamMaxLength`, `MaxFileSize`, `MaxScanSize`, recursion, archive, and
  timeout limits to fail closed at or just above LittleArc's 25 MB boundary;
- never use path-based scan commands across services;
- never expose `clamd` through a public domain or TCP proxy; and
- never log raw `clamd` replies.

ClamAV documents that its TCP protocol is neither encrypted nor authenticated.
Railway private networking is therefore a minimum synthetic-staging boundary,
not automatic production approval.

### 14.3 Environment Boundaries

| Environment | Scanner | Data | Boundary |
| --- | --- | --- | --- |
| Unit tests | Deterministic fake adapter | Generated synthetic byte fixtures | Cannot produce staging/production readiness evidence |
| Local integration | Optional official pinned ClamAV container on localhost/private Docker network | Runtime-generated EICAR test file and benign synthetic fixtures only | No Railway bucket; clean all temp/container artifacts |
| Local database | Disposable Aiven plus fake scanner/storage | Synthetic metadata/bytes only | Proves PostgreSQL/RLS/state, not live scanner/provider |
| Railway staging | Dedicated private ClamAV service pinned by digest, fresh signatures, no public network | Generated benign/EICAR/hostile synthetic fixtures only | Complete Railway staging stack; verify cost, RAM, health, logs, cleanup |
| Production | None in VLT-05 authorization | No data | Requires separate provider, privacy/security, capacity, incident, and production authorization |

### 14.4 Detection And Failure Behavior

- `detected` is terminal `rejected`; store only `malware_detected`.
- scanner timeout/unavailable/stale signature is retryable and never clean.
- invalid/ambiguous protocol response is retryable, then terminal operational
  `failed` after queue exhaustion.
- a false-positive release/redrive needs a future audited operator workflow;
  VLT-05 must not add an unreviewed bypass.
- scanner health and signature freshness participate in worker readiness and
  operational alerts.

## 15. Safe Preview Derivation Strategy

### 15.1 Authorization Boundary

Add two independent fail-closed switches:

- `FILE_VALIDATION_ENABLED=false` by default;
- `FILE_PREVIEWS_ENABLED=false` by default.

Rules:

- preview cannot be enabled unless validation is enabled;
- staging validation cannot be enabled unless database, storage, KEK, queue,
  parser, temp root, and scanner are healthy;
- staging preview cannot be enabled unless the renderer/Sharp capability probe
  passes;
- production rejects both switches until a separate production package is
  authorized; and
- a preview switch change must be documented, tested, and observable without
  per-file identifiers.

### 15.2 Derivative Model

Add a tenant-owned `file_derivatives` row with:

- derivative ID and original file-object relation;
- derivative kind/version;
- opaque storage key;
- ciphertext bytes and SHA-256;
- wrapped derivative DEK, wrap nonce, content nonce/tag, key/AAD versions;
- fixed detected MIME `image/jpeg`;
- processing state and safe error code;
- created/updated/deleted timestamps.

Do not store:

- an original/derived filename;
- PDF text or metadata;
- EXIF/XMP/IPTC/ICC;
- child or household information in the object key;
- a signed URL; or
- plaintext preview bytes.

The preview uses fresh encryption and AAD such as:

```text
protocol=littlearc-file
purpose=validation-preview
sourceObjectId=<immutable original file ID>
derivativeId=<immutable derivative ID>
format=image/jpeg
aadSchemaVersion=1
```

The API may expose a separately authorized preview download in a later reviewed
step. VLT-05 does not make the derivative public or attach it to a record.

### 15.3 Idempotency

Use one active derivative per `(source_file_id, derivative_kind,
derivative_version)`. Write to an opaque temporary object key, verify encrypted
size/hash, insert or compare the database row, then delete any redundant
provider object. Retries must not create orphan derivatives.

## 16. Plaintext Temporary-File Cleanup Strategy

### 16.1 Workspace Layout

The only permitted root is a validated configured directory such as:

```text
<FILE_VALIDATION_TMP_DIR>/<opaque-attempt-id>/
  ciphertext.part
  input.part
  input.bin
  preview-intermediate.bin
  preview-output.bin
```

Names are fixed and opaque. No original filename, MIME-derived extension,
household, child, file-object ID, or document title appears in a path.

The root must:

- resolve to an absolute path;
- not be `/`, the workspace, home, a persistent volume, or the object bucket;
- be created with `0700`;
- refuse symlinks and path traversal;
- have enough bounded free space before claim;
- support atomic rename within the same filesystem; and
- be empty/scavenged before worker readiness.

### 16.2 Success

Close subprocesses, streams, and file handles; zero mutable key buffers; remove
the entire attempt directory with bounded retries; verify absence; then commit
`ready`/`rejected` and acknowledge the job.

### 16.3 Retryable Failure

Abort active subprocess/scanner/storage streams; close handles; zero keys;
remove the workspace; persist only a safe retry category; allow `pg-boss`
backoff. If removal fails, retain the validating lease with
`plaintext_cleanup_retry`; do not release the job as successful or mark a
terminal business state.

### 16.4 Terminal Rejection Or Retry Exhaustion

Persist the proposed terminal outcome first as nonterminal
`result_pending_cleanup`; clean and verify the workspace; then commit
`rejected` or `failed`. Dead-letter job data remains the opaque file-object ID
only.

### 16.5 Cancellation And Graceful Shutdown

The worker stops dispatch/claim intake, signals active handlers, kills bounded
subprocesses after the grace period, cleans workspaces, releases/retries leases,
stops `pg-boss`, clears periodic timers, and then closes database/storage
resources.

There is no user-facing "cancel validation" operation in VLT-05. Operator job
cancellation must use the same abort/cleanup path and leave the file in a
retryable nonterminal state.

### 16.6 Crash, OOM, SIGKILL, Or Host Replacement

An in-process `finally` cannot run. Recovery is:

1. the database lease expires;
2. worker startup scans the dedicated temp root before queue intake;
3. only opaque directories older than the active lease/grace threshold are
   removed;
4. the worker verifies absence;
5. a security-definer recovery operation transitions stale `validating` or
   `result_pending_cleanup` rows to retryable `queued`;
6. the deterministic job is redriven or recreated; and
7. periodic scavenging repeats this logic for missed cases.

If the temp root cannot be enumerated or cleaned, the worker fails readiness
and does not accept new validation jobs.

## 17. Operational State Model

### 17.1 Persisted States

Proposed `file_objects.validation_state`:

```text
pending -> queued -> validating -> result_pending_cleanup -> ready
                                                    \-----> rejected
                                                    \-----> failed
```

Recovery transitions:

```text
validating --expired lease + cleanup--> queued
result_pending_cleanup --expired lease + cleanup--> queued
failed --approved manual redrive--> queued
```

`ready`, `rejected`, and `failed` are terminal for automatic processing.
`failed` is operational exhaustion, not a content rejection.

Proposed orthogonal states:

```text
malware_state:
  pending | clean | detected | unavailable | error

preview_state:
  not_authorized | pending | processing | ready | failed
```

### 17.2 Persisted Operational Fields

Add only:

- detected canonical MIME;
- bounded page count where applicable;
- validation policy version;
- malware engine class/version and signature freshness bucket or timestamp;
- validation attempt count;
- lease attempt ID and expiry;
- started/completed timestamps;
- safe error code;
- preview state/version;
- created/updated timestamps.

Do not persist parser/scanner raw output, action names found, malware signature
names, temp paths, filenames, content excerpts, OCR text, or exception
messages.

Household/child relations already exist for authorization and must remain in
the row; the new operational state and logs must not duplicate or emit them.

### 17.3 API Projection

Add a safe file-processing status projection:

```text
fileObjectId
validationState
previewState
safeErrorCode?
updatedAt
```

Do not expose malware details, policy internals, scanner versions, queue state,
attempt count, storage metadata, or keys. Responses use `cache-control:
no-store, private` and current household authorization.

The mobile app may continue to show a generic pending/ready/rejected/retry
status. Detailed VLT-06 review UX remains out of scope.

## 18. Queue, Retry, Idempotency, And Failure Matrix

| Condition | Retry? | State/action |
| --- | --- | --- |
| Duplicate outbox dispatch | No duplicate work | Confirm deterministic job; mark outbox dispatched |
| Duplicate/concurrent job | No concurrent parse | Lease/singleton makes later handler a no-op or retry |
| Already `ready`/`rejected` | No | Idempotent successful acknowledgement |
| Storage timeout | Yes | Cleanup, safe retry, backoff |
| Ciphertext size/hash mismatch | No | Cleanup, `rejected/ciphertext_integrity_mismatch` |
| GCM/AAD failure | No | Cleanup, `rejected/authenticated_decryption_failed` |
| MIME mismatch/unsupported | No | Cleanup, `rejected/type_mismatch` |
| Malformed/over-limit file | No | Cleanup, `rejected/malformed_structure` or limit code |
| PDF active/embedded/encrypted | No | Cleanup, generic rejected safe code |
| Malware detected | No | Cleanup, `rejected/malware_detected` |
| Scanner unavailable/stale | Yes | Cleanup, safe retry; never ready |
| Parser timeout/resource kill | Yes, then failed | Cleanup, backoff; terminal operational failure after exhaustion |
| Optional preview failure | Bounded preview retry | Original stays ready; `preview_state=failed` if exhausted |
| Temp cleanup failure | Yes and alert | Never terminal; `plaintext_cleanup_retry` |
| DB terminal commit failure after cleanup | Yes | Retry sees no workspace and recomputes/idempotently commits |
| Worker crash | Lease recovery | Startup/periodic cleanup, then requeue |
| Job retry exhausted | No automatic retry | Cleanup verified, `failed`, dead-letter, manual review |

## 19. Data Model And Migration Impact

### 19.1 Reviewed Forward Migration

Add `0007_vlt_05_file_validation.sql` only after plan authorization. It should:

- expand `file_objects.validation_state`;
- add the orthogonal malware/preview states and bounded operational columns;
- add a partial validation queue index;
- add `file_derivatives` only if preview implementation is authorized;
- add exact checks, tenant composite FKs, unique derivative idempotency, RLS,
  grants, and indexes;
- add security-definer functions for minimized outbox dispatch, validation
  claim, lease heartbeat, proposed result, cleanup-confirmed terminal commit,
  stale-lease recovery, and manual redrive;
- revoke direct worker access to tenant tables and grant only exact functions;
- insert the schema-migration checksum; and
- preserve old API/worker compatibility during a staged deploy.

No applied migration is edited. `db:push` is not used.

### 19.2 Queue Schema

`pg-boss` schema version 37 and the two queues must be installed/verified with a
migration-capable staging credential before the VLT-05 worker starts. Capture
and review the package-generated construction/migration plan and checksum.

Normal API and worker credentials receive only the minimum `pg-boss` runtime
grants. Worker startup fails closed on schema drift or missing queue
definitions; it does not silently grant itself DDL authority.

### 19.3 Audit And Outbox

Audit events may record:

- `file_validation_ready`;
- `file_validation_rejected`;
- `file_validation_failed`; and
- `file_preview_ready`.

Metadata is empty or a positive allowlist of policy version and generic result.
No malware/parser detail, MIME, filename, path, or content is included.

## 20. API And Contract Impact

- Extend file validation/preview state schemas from fixed `pending` to the safe
  state enums.
- Add an authenticated same-household status read for one file object.
- Keep upload completion idempotent while inserting exactly one minimized
  validation outbox event.
- Continue returning no storage key, job ID, parser/scanner detail, or key
  material.
- Gate automatic preview/OCR/record-linking access on `ready`.
- Preserve original encrypted download behavior only under current household
  and active-device authority; clients receive the safe validation state and
  must not automatically render a rejected object.
- Regenerate OpenAPI and mobile/staff clients and pass compatibility review.

No public upload request shape or file-size limit changes are required.

## 21. Storage Impact

Extend `EncryptedObjectStorage` with provider-neutral bounded operations:

- stream an encrypted object to the worker without a signed URL;
- put an encrypted derivative;
- verify derivative head/hash;
- delete an incomplete/redundant derivative; and
- optionally apply provider metadata that contains only fixed internal
  content-type/cache policy, never user data.

The adapter must not buffer 25 MB objects in memory, log storage keys, or expose
provider responses. The in-memory adapter gains deterministic stream failure,
partial write, duplicate, and cleanup behavior.

The original and derivative share the private documents bucket initially but
use separate opaque key prefixes and application encryption. A separate bucket
is not required unless measured operations or later retention policy demands
it.

## 22. Crypto Impact

Add streaming file-content helpers to `@littlearc/crypto`:

- authenticated AES-256-GCM decrypt from readable ciphertext to a write stream;
- derivative AES-256-GCM encryption from bounded raster input;
- canonical derivative AAD;
- exact nonce/tag/key checks;
- zero mutable file/household/KEK-derived buffers in `finally`; and
- reject any parser access until `decipher.final()` succeeds.

Do not duplicate envelope/file-key rules inside the worker. Do not persist a
plaintext DEK or return it in a job result.

## 23. Worker Impact

The worker becomes a composed runtime with:

- `pg-boss` lifecycle and queue consumers;
- outbox dispatcher;
- validation job handler;
- database lease/persistence adapter;
- object-storage streaming;
- key-unwrapping and streaming crypto;
- strict type/container validators;
- QPDF policy adapter;
- malware-scanner adapter;
- optional preview renderer;
- workspace manager/scavenger;
- graceful drain and signal handling;
- readiness self-checks; and
- safe metrics/log events.

Keep timer-based VLT-04 upload cleanup independent so a validation/scanner
failure cannot stop expired multipart cleanup.

## 24. Observability, Security, And Privacy Impact

### 24.1 Safe Logs And Metrics

Add positive-allowlist log codes such as:

```text
worker.file_validation.completed
worker.file_validation.retrying
worker.file_validation.failed
worker.file_validation.cleanup_failed
worker.file_validation.scavenged
worker.file_validation.dispatch_failed
```

Context is restricted to outcome, duration, retry count, queue-age bucket, and
optional opaque job/attempt ID. Add canary tests for filename, path, child data,
household ID, OCR/document content, PDF JavaScript text, EICAR text, object key,
digest, key material, and raw scanner response.

Aggregate metrics:

- queue ready/active/dead-letter counts;
- oldest job age bucket;
- validation outcome category;
- duration bucket by generic format class only if privacy review permits;
- retry/exhaustion count;
- scanner availability/signature freshness;
- temp cleanup failures and scavenged directory count;
- preview success/failure; and
- worker RSS/temp-space high-water marks.

### 24.2 Security Controls

- Synthetic fixtures only.
- No public scanner endpoint.
- No shell invocation or dynamic executable arguments.
- No parser runs before authenticated decryption completes.
- No active PDF or original file is served through a web renderer.
- No automatic OCR/record link/search from non-ready objects.
- No runtime DDL or broad worker table grants.
- No unbounded buffers, parser output, page count, object count, nested boxes,
  decompression, subprocesses, scan streams, retries, or concurrency.
- No terminal state before plaintext cleanup.
- No false "safe" claim: user/API wording is "validated" or "rejected", never
  "virus-free".

### 24.3 Privacy Controls

- Plaintext exists only in the worker's bounded leased workspace or scanner
  stream.
- The external network receives no document; ClamAV is self-hosted in the same
  isolated environment.
- No document bytes, filenames, text, content snippets, child data, or
  household identifiers enter telemetry, evidence, queue payloads, or
  provider logs.
- Scanner and parser raw output is discarded after mapping to a safe category.
- Preview metadata is stripped and the derivative encrypted before storage.
- Real-data enablement still requires privacy/legal/security/provider,
  retention, deletion, backup, and incident gates.

## 25. Configuration And Infrastructure Impact

Proposed worker variables:

| Variable | Class | Default | Purpose |
| --- | --- | --- | --- |
| `FILE_VALIDATION_ENABLED` | Public | `false` | Master fail-closed validation switch |
| `FILE_PREVIEWS_ENABLED` | Public | `false` | Independent preview authorization |
| `FILE_VALIDATION_TMP_DIR` | Sensitive | Platform temp subdirectory | Dedicated ephemeral workspace root |
| `FILE_VALIDATION_CONCURRENCY` | Public | `1` | Bounded job concurrency; compiled max enforced |
| `CLAMD_HOST` | Sensitive | Unset | Private scanner hostname |
| `CLAMD_PORT` | Sensitive | Unset | Private scanner port |
| `CLAMD_SIGNATURE_MAX_AGE_HOURS` | Public | Reviewed default | Fail-closed freshness threshold |

Existing storage, database, and key variables remain. Do not commit values.

Staging infrastructure changes, only after authorization:

- add exact worker watch paths for crypto, observability, domain, contracts, and
  any parser policy module;
- add reviewed QPDF/MuPDF/runtime packages to the final image;
- add a private ClamAV service pinned by digest and sized per official memory
  guidance;
- add variable manifest entries without values;
- add scanner health/signature checks;
- keep ClamAV without public networking;
- leave production service definitions untouched.

## 26. Affected Files And Modules

This is the implemented surface. Exact file names follow existing repository
conventions.

| Area | Expected files/modules |
| --- | --- |
| Plan/decision | this plan; `docs/adr/0016-worker-file-validation-and-plaintext-cleanup-boundary.md`; ADR index |
| Delivery docs after evidence | dashboard, M3 README, docs index/context map, roadmap status note, environment/release/testing references, VLT-05 evidence |
| Worker | `apps/worker/src/config.ts`, `index.ts`, `runtime.ts`, tests, new `file-validation/`, `queue/`, `workspace/`, `scanner/`, and `preview/` modules; `.env.example`; package manifest |
| API | upload completion/outbox behavior, file status route/service, tests, package manifest only if required |
| Domain | new file-validation states/transitions/safe codes and tests, exports |
| Contracts | file state/status schemas, OpenAPI resources, generated clients/baselines, compatibility tests |
| Database | file-object schema, optional derivative schema, validation persistence/outbox claim, migrations metadata/tests, reviewed `0007` SQL, exports, Aiven integration |
| Crypto | streaming file decrypt/derivative encrypt and AAD tests/exports |
| Storage | streaming read, encrypted derivative write, fake/S3 adapters and tests/exports |
| Observability | log-code/context allowlist, logger/canary/Sentry tests |
| Tooling | generated-output manifest, environment and Railway policies/tests, optional scanner/provider probe |
| Infrastructure | worker Railway config/watch paths, staging variable manifest, authorized private ClamAV service descriptor |
| Root scripts | focused `test:database:file-validation` and optional local scanner integration command |

No mobile production file is expected unless the approved contract generator
changes a generated client. A later UI package may consume the safe status.

## 27. Dependency And Service Decisions

### 27.1 Reuse Without Upgrade

- `pg-boss@12.26.1`: already pinned and compatible with Node 26/PostgreSQL.
- `sharp@0.35.3`: exact direct worker dependency required by the reviewed
  security remediation; it is paired with custom libvips `8.18.3`.
- existing AWS S3, Drizzle, crypto, observability, Vitest, and Zod stack.

### 27.2 Required Additions

- `file-type@22.0.1`: exact ESM magic-byte routing dependency. Required because
  the worker currently has no maintained content-signature detector. It never
  replaces strict format parsers.
- exact QPDF runtime: required for bounded PDF structure/object inspection.
- exact MuPDF runtime: required only when PDF preview is authorized.
- official ClamAV 1.4 LTS service pinned by digest: required for staging malware
  evidence; not an application npm dependency.

Before addition, record license, advisory, platform, build, and Node 26
compatibility. Do not upgrade any unrelated dependency.

### 27.3 Rejected Additions

- Redis, RabbitMQ, Kafka, hosted queue, or a second job system.
- a third-party cloud malware API that receives plaintext.
- a general-purpose document conversion SaaS.
- PDF.js as the security validator.
- filename/extension-based MIME libraries.
- a parser that requires buffering the whole 25 MB object without enforced
  limits.

## 28. Research And Primary Sources

### 28.1 MIME And Upload Validation

- OWASP File Upload Cheat Sheet: allowlist types, distrust client
  `Content-Type`, combine signature/content validation, generated filenames,
  size limits, isolated storage, and malware scanning:
  <https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html>
- `file-type` official repository: magic-number detection is a best-effort hint,
  malformed-input robustness is not a security guarantee, and untrusted files
  need size/time isolation:
  <https://github.com/sindresorhus/file-type>
- `file-type@22.0.1` npm package:
  <https://www.npmjs.com/package/file-type>

### 28.2 PDF Structure And Active Content

- QPDF `--check` and CLI documentation:
  <https://qpdf.readthedocs.io/en/latest/cli.html>
- QPDF JSON v2 documentation, including full object representation,
  unreferenced objects, and stream-data controls:
  <https://qpdf.readthedocs.io/en/latest/json.html>
- Adobe action documentation identifying JavaScript, Launch, ImportData,
  SubmitForm, URI, and other executable/external behaviors:
  <https://opensource.adobe.com/dc-acrobat-sdk-docs/library/pdfmark/pdfmark_Actions.html>
- Adobe embedded-file documentation:
  <https://opensource.adobe.com/dc-acrobat-sdk-docs/library/pdfmark/pdfmark_Basic.html>
- Adobe JavaScript documentation showing document-, page-, form-, bookmark-,
  and link-level script locations:
  <https://opensource.adobe.com/dc-acrobat-sdk-docs/library/jsdevguide/JS_Dev_Tools.html>

### 28.3 Malware Scanning

- ClamAV scanning and `clamd` network warning:
  <https://docs.clamav.net/manual/Usage/Scanning.html>
- ClamAV `INSTREAM` protocol and `StreamMaxLength`:
  <https://docs.clamav.net/manual/Usage/ClamdProtocol.html>
- Official signature management with `freshclam`:
  <https://docs.clamav.net/manual/Usage/SignatureManagement.html>
- ClamAV support/functionality levels:
  <https://docs.clamav.net/appendix/FunctionalityLevels.html>
- Official ClamAV container selection and memory guidance:
  <https://docs.clamav.net/manual/Installing/Docker.html>

### 28.4 Safe Preview And Process Bounds

- Sharp constructor safety limits and strict failure behavior:
  <https://sharp.pixelplumbing.com/api-constructor/>
- Sharp output behavior; metadata is removed by default unless explicitly
  preserved:
  <https://sharp.pixelplumbing.com/api-output/>
- MuPDF `mutool draw` bounded width/height, page selection, and banded rendering:
  <https://mupdf.readthedocs.io/en/1.26.1/mutool-draw.html>
- Node 26 `child_process` timeout, abort, direct executable, bounded buffer, and
  no-shell behavior:
  <https://nodejs.org/api/child_process.html>
- Node 26 recursive `fsPromises.rm` retry behavior:
  <https://nodejs.org/api/fs.html>
- Linux `no_new_privs`:
  <https://man7.org/linux/man-pages/man2/PR_SET_NO_NEW_PRIVS.2const.html>

### 28.5 Queue And Hosting

- `pg-boss` official repository and transactional/retry/dead-letter behavior:
  <https://github.com/timgit/pg-boss>
- Railway private networking:
  <https://docs.railway.com/private-networking>
- Railway/Railpack final-image Apt package configuration:
  <https://docs.railway.com/builds/build-configuration>

## 29. Testing Strategy

### 29.1 Pure Unit Tests

- validation-state transition table and safe-code exhaustiveness;
- outbox payload exact-shape and no-sensitive-field tests;
- magic/declaration agreement and HEIF alias normalization;
- strict JPEG marker/EOI/trailing-byte cases;
- strict PNG chunk/order/CRC/IEND/trailing-byte cases;
- bounded ISO-BMFF sizes, nesting, brands, sequences, and overflow;
- queue retry/idempotency/dead-letter projection;
- temp-root path/symlink/permission/free-space guards;
- cleanup on success, rejection, thrown error, abort, timeout, and simulated
  deletion failure;
- startup/periodic stale workspace scavenging;
- key/AAD/tamper/zeroing and no parser-before-authentication behavior;
- Sharp limit/metadata/output behavior when preview is enabled;
- log/Sentry/error leakage canaries.

### 29.2 PDF Corpus Tests

Generate synthetic fixtures in tests rather than committing real documents:

- minimal valid static PDF;
- 1-page and 50-page limits; reject 0/51;
- truncated/xref/page-tree/object-stream corruption;
- parser warning/repair cases;
- encrypted/password-protected PDF;
- JavaScript hidden in catalog, page, annotation, form, bookmark, action chain,
  object stream, and unreferenced object;
- `/OpenAction`, `/AA`, `/Launch`, `/URI`, `/SubmitForm`, `/ImportData`,
  `/GoToR`;
- embedded file, portfolio, file attachment;
- XFA, AcroForm, rich media, sound, movie, and 3D;
- object/depth/JSON-output/resource bombs;
- valid PDF plus appended executable/polyglot payload;
- QPDF timeout/kill/output-cap handling; and
- first-page preview success/timeout/oversize only when authorized.

The test assertion records safe categories, not embedded content.

### 29.3 Malware Tests

- deterministic fake clean/detected/unavailable/stale/protocol-error/timeout;
- chunked `INSTREAM` framing and exact total limit;
- raw scanner response never reaches logs/state;
- runtime-generated EICAR standard test file is detected in local and staging
  integration, never committed as participant data, and removed afterward;
- signature freshness/readiness failure; and
- no file path is sent to a remote scanner.

EICAR is a standard harmless antivirus test artifact, not real malware. It must
not appear in logs, evidence payloads, or operational state.

### 29.4 Database And Queue Integration

Use a disposable local Aiven database:

- apply reviewed migrations including the exact `pg-boss` schema plan;
- upload completion atomically creates one file and one minimized outbox event;
- rollback creates neither;
- worker claim functions expose no child ID and only one file's key/storage
  material;
- RLS and direct worker-table access remain denied;
- deterministic outbox redispatch creates no duplicate job;
- retry, heartbeat, expiry, dead-letter, and redrive behavior;
- concurrent duplicate jobs do not run concurrent parsing;
- lease expiry does not requeue before cleanup confirmation;
- terminal commit is impossible while cleanup is pending;
- ready/rejected/failed and optional derivative checks;
- immutable original and idempotent derivative/provider cleanup;
- safe audit metadata; and
- two synthetic households cannot cross-read or mutate state.

Local Aiven uses fake object storage and fake scanner unless running a separate
local-only scanner integration. It does not use Railway resources.

### 29.5 Storage/Crypto Integration

- bounded streamed read under normal, partial, timeout, and disconnect cases;
- ciphertext size/hash mismatch;
- authenticated decrypt failure before parser invocation;
- encrypted derivative upload/head/hash/delete;
- duplicate derivative cleanup;
- provider error mapping without raw response leakage; and
- all temporary files/keys absent after every path.

### 29.6 Contract/API Tests

- safe state schema and OpenAPI/client drift;
- same-household status allow and cross-household/revoked deny;
- `no-store, private`;
- pending/ready/rejected/failed projections;
- no scanner/storage/key/job internals; and
- original download does not auto-authorize preview/OCR/linking.

### 29.7 Crash And Recovery Tests

Run the handler in a child process and terminate it at each stage:

- after workspace creation;
- during ciphertext download;
- after plaintext creation;
- during QPDF;
- during scan;
- during preview;
- after result proposal;
- after cleanup but before terminal commit; and
- after terminal commit but before queue acknowledgement.

Restart the worker and prove workspace absence, correct lease recovery,
idempotent state, no orphan derivative, and no sensitive logs.

## 30. Validation Commands

### 30.1 Planning Validation

Run in this planning-only change:

```sh
pnpm check:toolchain
pnpm check:docs
pnpm check:format
git diff --check
```

### 30.2 Focused Implementation Validation

Expected commands after authorization:

```sh
pnpm --filter @littlearc/domain test
pnpm --filter @littlearc/crypto test
pnpm --filter @littlearc/storage test
pnpm --filter @littlearc/database test
pnpm --filter @littlearc/contracts test
pnpm --filter @littlearc/observability test
pnpm --filter @littlearc/api test
pnpm --filter @littlearc/worker test
pnpm --filter @littlearc/worker typecheck
pnpm test:database:file-validation
pnpm test:database:rls
pnpm test:contract
pnpm test:unit
pnpm typecheck
```

`test:database:file-validation` is the implemented root integration command.

### 30.3 Provider/Sandbox Integration

Proposed commands, to be added and documented rather than improvised:

```sh
pnpm test:integration:file-validation-tools
pnpm test:integration:clamav
railway variable set FILE_VALIDATION_STAGING_PROBE=true \
  --service littlearc-worker-staging --environment staging
# Wait for the safe probe pass line and a healthy worker deployment.
railway variable set FILE_VALIDATION_STAGING_PROBE=false \
  --service littlearc-worker-staging --environment staging
```

The tools check must print only versions and generic pass/fail counts. It must
not print input paths, file content, scanner signatures, storage identifiers,
or secrets.

### 30.4 Broad Repository Validation

```sh
pnpm install --frozen-lockfile
pnpm check:workspace
pnpm check:format
pnpm check:docs
pnpm check:supply-chain
pnpm test
pnpm typecheck
pnpm build
pnpm validate
./tooling/validate-clean-checkout.sh
git diff --check
```

Native Expo prebuild/build/export and physical-device checks are not VLT-05
acceptance requirements unless implementation unexpectedly changes mobile or
native code. If generated mobile contracts change, run release exports and
containment checks, but do not overstate them as device functionality evidence.

## 31. Staging And External-Service Validation

After separate authorization:

1. Confirm the environment is Railway `staging`; production has no VLT-05
   service/config changes.
2. Apply reviewed LittleArc migration `0007`.
3. Apply/verify the reviewed `pg-boss` schema version and create the exact queue
   definitions with migration authority.
4. Provision the private ClamAV service pinned by digest, with sufficient RAM,
   no public domain/TCP proxy, current signatures, and bounded configuration.
5. Deploy the worker with exact parser binaries and validation enabled but
   previews still off.
6. Verify parser versions, queue schema, temp-root safety, storage, KEK,
   scanner readiness/signature freshness, database migration, and worker
   lifecycle before accepting jobs.
7. Process generated benign JPEG, PNG, HEIC/HEIF, and static PDF fixtures.
8. Process generated malformed, MIME-mismatch, active PDF, embedded PDF,
   resource-limit, ciphertext-tamper, and EICAR fixtures.
9. Force storage, scanner, parser timeout, database, worker restart, and cleanup
   failures.
10. Verify retry/dead-letter/lease recovery and terminal state accuracy.
11. If preview is separately authorized, enable it only after the sandbox probe
    and validate encrypted metadata-free derivatives.
12. Confirm safe API status, safe worker/API/scanner logs, aggregate metrics,
    and no plaintext canary in database/job/log/error state.
13. Confirm the worker temp root is empty and no incomplete/redundant derivative
    remains.
14. Delete every synthetic object, multipart upload, derivative, job fixture,
    and test database row permitted by the evidence cleanup procedure.
15. Disable validation/preview switches after the probe unless founder
    direction explicitly keeps synthetic staging enabled.

The evidence dossier must separate:

- local pure/worker tests;
- disposable Aiven PostgreSQL/queue tests;
- local ClamAV integration;
- Railway staging ClamAV/object-storage/worker evidence; and
- any contract/mobile release-containment checks.

No one layer substitutes for another.

## 32. Android And iOS Implications

### 32.1 Worker-Only Acceptance

VLT-05 does not add camera, scanner, picker, share, biometric, SQLCipher,
foreground-preview, or native dependency behavior. Physical Android and iOS
Simulator execution are therefore not required to prove worker MIME/PDF,
malware, queue, or plaintext-cleanup behavior.

### 32.2 Contract/UI Consequences

The generated mobile client may gain safe validation states. The existing
uploaded-pending-validation UI remains truthful. A later reviewed UI step may
show generic:

- validating;
- ready;
- rejected;
- temporarily unavailable/retry; and
- preview unavailable.

It must not display malware signature, parser detail, filename from server
state, or imply clinical validity.

### 32.3 Evidence Boundary

If Android/iOS release exports are run because generated contract code changes,
record them as compile/release-containment evidence only. They are not:

- physical-device file-validation evidence;
- physical-iOS evidence;
- two-device conflict evidence;
- low-end performance evidence; or
- Gate 2 closure.

## 33. Ordered Implementation Steps And Verification Points

Each step is independently reviewable. Do not start Step 1 until the plan is
accepted and implementation is separately authorized.

1. **Finalize plan and authorization.**
   - Resolve blocking questions, record the exact founder direction, and keep
     Gate 2 open unless its own criteria pass.
   - Verify: docs/format/diff checks only.
2. **Record durable trust decisions.**
   - Add ADR-0016 with queue, key authority, parser/scanner, preview, temp
     cleanup, and telemetry boundaries.
   - Verify: documentation governance and source links.
3. **Add pure domain state/policy.**
   - Add enums, transitions, safe codes, limits, and tests without I/O.
   - Verify: domain tests/typecheck.
4. **Add streaming crypto and storage primitives.**
   - Implement authenticated stream decrypt, derivative encrypt, streamed
     object read/write, fake adapters, and failure tests.
   - Verify: crypto/storage tests; tamper prevents parser invocation.
5. **Add reviewed database migration/persistence.**
   - Expand file state, add optional derivatives, outbox event, claim/lease/
     cleanup/terminal functions, RLS/grants, and generated migration metadata.
   - Verify: schema/migration tests and disposable Aiven tenant/authority tests.
6. **Prepare durable queue schema.**
   - Review pinned `pg-boss` construction/migration plan, create queues/DLQ,
     define exact options, and add schema-drift checks.
   - Verify: disposable Aiven queue lifecycle, duplicate dispatch, retry, expiry,
     heartbeat, and dead-letter.
7. **Implement workspace manager first.**
   - Add temp-root safety, lease directories, cleanup, startup/periodic
     scavenging, abort/drain, and crash tests before plaintext parsing.
   - Verify: every injected failure leaves no workspace; cleanup failure blocks
     terminal commit.
8. **Implement signature and image/container validators.**
   - Add exact detector, strict JPEG/PNG/ISO-BMFF validation, resource limits,
     and generated hostile corpus.
   - Verify: focused validator tests and subprocess/memory bounds.
9. **Implement bounded PDF policy.**
   - Add exact QPDF runtime, check/JSON traversal, deny list, page/object/depth/
     output/time limits, and corpus tests.
   - Verify: all active/embedded/encrypted/repair/resource fixtures reject with
     generic safe codes; valid static fixtures pass.
10. **Implement malware provider boundary.**
    - Add fake and `clamd INSTREAM` adapters, readiness/freshness policy, abort/
      timeout, and response scrubbing.
    - Verify: fake matrix plus local official ClamAV benign/EICAR integration.
11. **Compose the validation handler and dispatcher.**
    - Wire outbox to deterministic jobs, claims, crypto, validators, scanner,
      cleanup-before-terminal, idempotent ack, and graceful shutdown.
    - Verify: worker tests, child-process crash matrix, no-sensitive-log canaries.
12. **Add API/contract safe status.**
    - Extend state projections/status route, authorization, generated clients,
      download gating semantics, and compatibility tests.
    - Verify: API/contract tests and cross-household/revoked denial.
13. **Implement optional preview only if separately authorized.**
    - Add Sharp/MuPDF, raster/metadata/output bounds, derivative encryption/
      idempotency, and capability flag.
    - Verify: metadata absence, limits, encrypted storage, cleanup, and preview
      failure independence.
14. **Run focused and broad local validation.**
    - Fix every failure before hosted work.
    - Verify: Section 30 commands and clean-checkout proof.
15. **Run bounded Railway staging validation.**
    - Apply reviewed migrations/queue schema, deploy private scanner and worker,
      run synthetic matrix/failures, inspect safe metrics/logs, and clean all
      artifacts.
    - Verify: Section 31 checklist with production untouched.
16. **Review, document, and close only the bounded package.**
    - Create evidence, align the plan/dashboard/M3 index/docs, list deferred
      checks, and mark complete only if every authorized criterion passes.
    - Verify: final diff, docs governance, source traceability, exact evidence
      boundaries, and manual follow-up.

## 34. Acceptance Criteria

VLT-05 may be marked complete only when all authorized applicable criteria pass:

1. Every VLT-04 upload completion atomically creates exactly one minimized
   validation dispatch fact.
2. The pinned `pg-boss` schema/queues are reviewed, reproducible, drift-checked,
   and operated without giving runtime roles general DDL authority.
3. Queue payloads/dead letters contain only an opaque file-object ID.
4. Duplicate dispatch, duplicate jobs, worker restart, expiry, and retry cannot
   cause concurrent parsing or inconsistent terminal states.
5. The worker claims only one file's minimum storage/decryption material and no
   child ID, filename, record content, or unrelated tenant row.
6. Ciphertext size/hash and AES-GCM AAD/tag are reverified before plaintext is
   accepted or any parser runs.
7. Detected MIME comes from bytes, matches the canonical declared type, and is
   never accepted on signature alone.
8. JPEG, PNG, and HEIC/HEIF validators consume the complete allowed structure
   and enforce bounded limits. HEIC/HEIF additionally proves a complete
   single-primary-image pixel decode through the accepted exact pinned worker
   image and sandbox.
9. PDF validation is bounded by size, pages, objects, nesting, output, memory,
   CPU, wall time, and concurrency.
10. Encrypted/password-protected, active, external-action, embedded-file, form/
    XFA, rich-media, malformed, repair-requiring, and over-limit PDFs are
    rejected with generic safe codes.
11. Malware `clean` is required for `ready`; detected, unavailable, stale,
    timeout, protocol-error, and ambiguous results cannot become ready.
12. Local fake scanning and live scanner evidence remain explicitly separate.
13. The staging scanner is pinned, private, current, healthy, bounded, and
    receives streams rather than paths.
14. Preview derivation is disabled by default and cannot be enabled without
    validation plus separate authorization and capability checks.
15. When preview is authorized, it is first-page/frame only, bounded,
    metadata-free, fixed-raster, freshly encrypted, idempotent, privately
    stored, and independently stateful.
16. The encrypted original is never rewritten, silently deleted, linked to a
    record, passed to OCR, or made searchable by VLT-05.
17. Every success, rejection, retryable error, cancellation, graceful shutdown,
    parser kill, scanner failure, cleanup failure, and injected crash follows
    the cleanup state machine.
18. No `ready`, `rejected`, or terminal `failed` transition occurs until the
    attempt workspace is verified absent.
19. Startup and periodic recovery remove stale crash workspaces before
    requeueing leases; an uncleanable temp root fails worker readiness.
20. Mutable KEK-derived, household-key, and file-key buffers are cleared after
    bounded use and never persisted or logged.
21. Logs, metrics, audit, queue, job output, database error state, API errors,
    screenshots, and evidence contain no filename, path, document content,
    child data, household identifier, storage capability, key/hash material,
    raw parser/scanner response, malware signature, or plaintext canary.
22. API status is same-household authorized, cache-disabled, and exposes only
    safe processing state.
23. Direct cross-household and direct worker-table access fail closed under real
    PostgreSQL RLS/grants.
24. Disposable Aiven database tests and complete Railway staging provider tests
    remain separate and synthetic-only.
25. The staging failure matrix proves retries, dead letter, stale lease, process
    restart, scanner outage, parser timeout, cleanup failure, and artifact
    cleanup.
26. Root unit/contract/type/build/validation, docs/format/workspace/supply-chain,
    clean-checkout, and diff checks pass on Node 26.4.0 and pnpm 11.14.0.
27. Android/iOS evidence, if run, is described only as contract build or release
    containment and does not overclaim worker/device/Gate 2 proof.
28. Production remains unconfigured and real child/household/participant/
    medical data remains absent.
29. An evidence dossier lists every passed, failed, deferred, manual, and
    unrun validation without marking the package complete prematurely.
30. The dashboard, M3 index, plan state, roadmap delivery note, ADR/reference
    docs, and evidence are aligned only after acceptance.

## 35. Risks And Controls

| Risk | Impact | Control |
| --- | --- | --- |
| VLT-05 exception mistaken for broader authorization | Unauthorized M3 implementation | Keep Gate 2 open and VLT-06+ blocked without another explicit direction |
| Magic bytes treated as proof | Polyglot/malformed content accepted | Strict full-container parsing plus malware scan |
| Hostile PDF exploits parser | Worker compromise/data exposure | Exact patched tools, bounded no-shell subprocess, non-root/no-new-privs, resource caps, optional service split |
| QPDF deny list misses hidden objects | Active content accepted | Traverse all parsed and unreferenced objects; generated corpus; fail on parser warning |
| Legitimate signed/form PDF rejected | User friction | Conservative MVP rejection; reopen with named use case and review |
| ClamAV false negative | Unsafe file marked ready | Layered structure/active checks, updated signatures, honest claims, incident process |
| ClamAV false positive | Legitimate file rejected | Preserve encrypted original; no unreviewed bypass; future audited redrive |
| Scanner TCP exposed or intercepted | Plaintext disclosure/control | Private-only service, no public domain/proxy, `INSTREAM`, production review; split/local socket if needed |
| Scanner signatures stale | False clean result | Freshness readiness gate; unavailable/retry rather than clean |
| ClamAV memory pressure | Worker/scanner OOM | Separate service, 4 GiB planning baseline, concurrency one, metrics/load test |
| Parser/preview resource bomb | Availability failure | Size/page/pixel/object/depth/time/memory/output/process caps |
| Crash bypasses `finally` | Plaintext residue | Lease-before-work, startup/periodic scavenger, cleanup-before-terminal invariant |
| Cleanup itself fails | Persistent plaintext | Retry/alert/readiness failure; never terminal while cleanup pending |
| Queue delivers duplicate | Duplicate parsing/derivative | Deterministic job, singleton/lease, idempotent state/provider writes |
| Outbox sent but not marked | Repeated dispatch | Same deterministic ID and duplicate confirmation before finish |
| Runtime queue auto-migrates | Unreviewed DDL/drift | Migration credential prepares schema; runtime verifies exact version |
| Worker receives excessive key/data access | Cross-tenant blast radius | Security-definer single-object claim; no table grants; Aiven RLS/grant tests |
| Preview preserves metadata/text | Privacy leak | Rasterize, strict re-encode, no metadata, encrypted derivative, canary tests |
| Original rejected file auto-renders | Device exposure | Safe state gating; no automatic preview/OCR/link/search |
| Logs include parser/scanner error | Content/path leak | Stable positive allowlist; discard raw output; canary tests |
| Staging result called production proof | Evidence overclaim | Explicit local/Aiven/staging/production separation |

## 36. Rollback

### 36.1 Application Rollback

- Set `FILE_VALIDATION_ENABLED=false` and
  `FILE_PREVIEWS_ENABLED=false`.
- Stop queue intake and gracefully drain/clean active attempts.
- Redeploy the last known-good worker/API if needed.
- Leave pending/queued files non-ready; never promote them during rollback.
- Keep encrypted originals and existing VLT-04 download authority intact.

### 36.2 Queue Rollback

- Pause the validation queue and dispatcher.
- Preserve minimized jobs for the approved diagnostic window.
- Do not delete dead-letter jobs until safe state is reconciled.
- Redrive only after the fixed worker and cleanup readiness pass.

### 36.3 Database Rollback

The forward migration must be backward-compatible with the VLT-04 API/worker:

- VLT-04 can continue writing `pending`;
- new columns have safe defaults;
- old code ignores new states only while validation is disabled; and
- derivative tables are additive.

Do not automatically reverse an applied migration. Use a reviewed compatibility
forward fix or restore procedure. Never remove state while jobs or plaintext
cleanup leases are active.

### 36.4 Provider Rollback

- Disable validation before removing ClamAV or parser dependencies.
- Confirm no active leased workspace.
- Remove only synthetic staging scanner resources after evidence cleanup.
- Production remains untouched.

## 37. Manual Steps And Deferred Checks

Completed manual/externally coordinated work:

- founder acceptance and separate VLT-05 implementation authorization;
- review of worker plaintext authority and private scanner topology;
- private staging ClamAV service using a digest-pinned image;
- immutable QPDF artifact/checksum and subprocess-control verification;
- migration-credential execution for `pg-boss` schema and `0007`;
- staging variable/service configuration without recording secret values;
- staging deploy and terminal health inspection; and
- synthetic benign/EICAR, QPDF sandbox, and complete-cleanup probe; and
- local Homebrew ClamAV 1.5.3 production-adapter integration covering
  readiness, clean, detected, bounded, unavailable, and cleanup behavior;
- separately authorized bounded HEIC decode; and
- separately authorized encrypted-preview implementation and staging-only
  enablement.

Still deferred:

- authenticated mobile-to-staging-worker lifecycle pending an organization-owned
  synthetic identity or separately reviewed ephemeral harness;
- future production provider/capacity/incident/retention approval; and
- future UI/OCR/record-linking packages.

Owners, triggers, execution boundaries, and closure evidence are recorded in
the [VLT-05 follow-up closure plan](./vlt-05-follow-up-closure-plan.md).

Deferred and not acceptance evidence unless separately authorized:

- real documents or participant data;
- production scanner/storage/worker;
- physical Android/iOS file-validation behavior;
- physical iOS/Secure Enclave;
- two-device conflict;
- low-end Android;
- full TalkBack/VoiceOver/accessibility matrix;
- signed/form PDF support;
- content-disarm/reconstruction;
- OCR/extraction;
- legal retention/deletion durations; and
- Gate 2 closure.

## 38. Plan Review Checklist

- [x] Roadmap scope has not expanded into VLT-06+.
- [x] Gate 2 and separate founder-authorization language is accepted.
- [x] Static-PDF rejection policy is accepted.
- [x] Worker key authority and security-definer claim shape are accepted.
- [x] Outbox/`pg-boss` schema and retry settings are accepted.
- [x] Cleanup-before-terminal invariant and crash recovery are accepted.
- [x] ClamAV staging topology, cost, memory, and privacy are accepted.
- [x] Preview is explicitly deferred with `FILE_PREVIEWS_ENABLED=false`.
- [x] API rejected-original download behavior is accepted.
- [x] Proposed dependencies/system tools are reviewed.
- [x] Staging evidence and production deferral are accepted.

## 39. Implementation-Ready Context Summary

### Decisions

- Use the existing VLT-04 encrypted original and immutable file-object boundary.
- Insert a minimized validation outbox event atomically at upload completion.
- Activate pinned `pg-boss@12.26.1` with deterministic jobs, bounded retries,
  heartbeat, singleton/lease idempotency, and a dead-letter queue.
- Claim one object's minimum decryption/storage material through
  security-definer functions.
- Require layered signature plus complete structure validation and a clean
  malware result for `ready`.
- Accept only conservative static, unencrypted PDFs; reject active, embedded,
  form/XFA, rich-media, malformed, and over-limit content.
- Use ClamAV through a provider-neutral `INSTREAM` adapter; fake locally and
  private pinned service in authorized synthetic staging.
- Keep preview independent and disabled by default; when authorized, generate
  one metadata-free encrypted JPEG derivative.
- Never commit a terminal validation state before the attempt workspace is
  verified removed.
- Use safe state/codes and aggregate telemetry without filenames, content,
  child data, household identifiers, or plaintext canaries.

### Constraints

- VLT-05 alone was separately authorized and implemented.
- Gate 2 remains open and `VLT-06+` stays blocked without separate founder
  direction or Gate 2 closure.
- Synthetic data only; no real child, household, participant, or medical
  documents.
- Local Aiven and Railway staging resources remain separate.
- Production validation, scanner, previews, and deployment remain disabled.
- No unrelated dependency upgrades, Redis/hosted queue, cloud scanning, OCR,
  record linking, search, or native feature changes.
- Node 26.4.0 and pnpm 11.14.0.

### Files To Edit

- `apps/worker/**`;
- focused `apps/api` upload/status files;
- `packages/domain`, `contracts`, `database`, `crypto`, `storage`, and
  `observability`;
- reviewed database/queue migrations;
- worker Railway config and staging manifest/provider descriptor;
- focused tooling/root scripts;
- ADR-0016 and affected plan/status/index/reference/evidence docs after
  validation.

### Commands To Run

```sh
pnpm --filter @littlearc/worker test
pnpm --filter @littlearc/worker typecheck
pnpm test:database:file-validation
pnpm test:database:rls
pnpm test:contract
pnpm test:unit
pnpm typecheck
pnpm check:workspace
pnpm check:format
pnpm check:docs
pnpm check:supply-chain
pnpm build
pnpm validate
./tooling/validate-clean-checkout.sh
git diff --check
```

Also run the approved local tool/ClamAV integration and complete Railway
staging synthetic probe described in Sections 30 and 31.

### Acceptance Criteria

- Atomic minimized dispatch; reviewed reproducible queue schema.
- Idempotent retry/dead-letter/lease behavior.
- Ciphertext/AAD verification before parser access.
- Strict JPEG/PNG/PDF validation with bounded hostile-input handling; HEIC
  remains fail-closed pending an authorized bounded decoder.
- Static PDF only; active/embedded/encrypted content rejected.
- Current clean malware scan required for ready.
- Optional preview is bounded, metadata-free, freshly encrypted, and separately
  authorized.
- Plaintext cleanup succeeds before every terminal state, with startup/periodic
  crash recovery.
- No sensitive state in logs, jobs, audit, errors, API, evidence, or residual
  files.
- Aiven RLS/queue, local scanner-protocol tests, Railway staging provider, broad
  repository, and clean-checkout checks pass within their separate evidence
  boundaries.
- Production/real-data/Gate 2/device claims remain unchanged.

### Known Risks/Blockers

- Gate 2 blocks automatic progression to `VLT-06+`.
- Preview authorization remains deferred to the first `VLT-08` remote Vault
  consumer unless separately moved earlier.
- HEIC support is limited to the accepted exact pinned worker image and
  single-primary-image policy; it does not authorize `VLT-06` OCR.
- Full mobile-to-staging evidence remains blocked on a safe synthetic staging
  identity boundary; no durable authentication bypass is allowed.
- ClamAV signature attestation must be refreshed before its 72-hour expiry.
- Static-PDF policy may reject signed/form PDFs.
- Production scanner, retention, incident, provider, and real-data gates remain
  unresolved.

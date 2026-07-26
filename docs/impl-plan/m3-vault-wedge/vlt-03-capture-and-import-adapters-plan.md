# VLT-03 Capture And Import Adapters Plan

> **Status:** Complete
> **Plan state:** Implemented and accepted within the recorded device boundary
> **Started date:** 2026-07-24
> **Last updated:** 2026-07-25
> **Owner:** Engineering
> **Milestone:** M3
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
> **Roadmap:** [M3 Vault Wedge](../roadmap.md#m3--vault-wedge)
> **Research:** [Capture adapter research](./vlt-03-capture-and-import-adapters-research.md)

---

## Outcome

An enrolled parent can start a capture draft from the production record
experience, acquire synthetic JPEG, PNG, HEIC/HEIF, or PDF sources through the
document scanner, direct camera, photo library, file picker, or incoming
platform share path, and resume the opaque draft after interruption.

Every accepted source is copied into an app-private staging location, inspected
by content rather than filename, bounded to 25 MB and 50 pages, normalized when
it is an image, given a bounded thumbnail off the JavaScript thread, encrypted
independently through the accepted local-file boundary, and represented by
SQLCipher metadata. Cancellation and rejection preserve an existing draft and
clean partial artifacts. VLT-03 does not upload a file, run OCR, create
suggestions, or confirm a record.

## Authorization And Gate Boundary

Gate 2 remains open. Founder direction on 24 July 2026 explicitly authorizes
this bounded VLT-03 package to proceed after its plan is reviewed, validated,
and finalized.

This exception:

- authorizes only VLT-03 capture/import adapters, native preprocessing, and
  resumable local capture drafts;
- does not close Gate 2 or authorize VLT-04 and later M3 breadth;
- does not replace missing two-physical-device, low-end Android, complete
  assistive-technology, or physical-iOS evidence;
- does not permit real child, parent, clinical, document, provider, or
  government data; and
- does not broaden live-provider, production-deployment, signed-distribution,
  pilot, or real-data claims.

## Scope

- Add production acquisition adapters for:
  - native multi-page document scanner;
  - direct rear-camera image capture;
  - multi-image photo-library selection;
  - multi-file JPEG, PNG, HEIC/HEIF, and PDF selection; and
  - incoming Android and iOS platform shares containing those file types.
- Use `expo-sharing` as the first-party incoming-share integration, route
  recognized native intents through Expo Router, and reject unrelated or
  malformed paths without exposing payloads in URLs or logs.
- Add a narrow local Expo module that asynchronously:
  - detects JPEG, PNG, HEIC/HEIF, and PDF from magic bytes;
  - returns trustworthy size, dimensions, orientation, and page count;
  - normalizes image orientation;
  - writes bounded JPEG thumbnails for images and the first PDF page; and
  - uses opaque output names in an app-private staging directory.
- Apply the accepted initial limits: 25 MB per original and 50 pages per
  capture draft/PDF.
- Add SQLCipher schema V6 for `local_capture_drafts` and
  `local_capture_assets`, including source kind, ordered page/file position,
  detected type, original size, page count, normalized dimensions, encrypted
  original/thumbnail file IDs, safe state, safe failure code, and timestamps.
- Generalize the accepted ADR-0011 local-file primitive so production capture
  can encrypt, open for a bounded preview, and delete local files with
  independent AES-256-GCM keys, immutable AAD, opaque names, and SQLCipher
  metadata.
- Ensure a draft and its asset rows become visible only after original and
  thumbnail encryption succeeds. Clean staging files and partial encrypted
  files on failure.
- Preserve an existing draft on picker cancellation, permission denial,
  unsupported type, size/page rejection, process interruption, or failed
  additional import.
- Add production routes/components for source choice, purpose-specific
  permission rationale, processing status, draft asset list, textual validation
  errors, retry, and explicit discard.
- Link the bounded record-management screen to the capture entry point while
  retaining manual record creation.
- Use semantic design tokens, scrolling layouts, minimum touch targets,
  non-color state text, accessibility labels/headings/live announcements, and
  reduced-motion-safe behavior.
- Add development-only synthetic orchestration that drives production
  components and repository/native paths on physical Android and iOS
  Simulator, while retaining release-bundle containment.
- Add focused policy, SQLCipher migration/repository, local-file lifecycle,
  native processor, Router handoff, UI/presentation, release-containment, and
  regression tests.
- Create an implementation evidence dossier and align the dashboard, roadmap,
  M3/repository indexes, context map, ADR reviews, and validation records.

## Out Of Scope

- Upload sessions, object storage, multipart/resumable transport, server file
  objects, key wrapping, downloads, or attachment grants (`VLT-04`).
- Worker-side magic verification, malware scanning, quarantine, decompression
  defense, or processing status (`VLT-05`).
- OCR, source snippets, suggested fields, confidence, AI processing, consented
  processors, or extraction review (`VLT-06`).
- Capture-to-record confirmation, record-file links, or changing a VLT-02
  manual record's provenance. A capture draft is not a record.
- Search, full Vault browsing, duplicate merging, retention policy, upload
  failure recovery, reminders, or provider/government ingestion.
- Cloud processing, external provider credentials, real document samples, real
  participant data, physical iOS, store signing, or pilot distribution.
- Broad Android/iOS share-type support. Text, URLs, movies, audio, archives,
  office documents, and arbitrary binary files are rejected.
- Background processing while the app is locked.

## Source Traceability

| Requirement | Source |
| --- | --- |
| Package scope and ordering | Roadmap Section 12 |
| Supported sources and pipeline stages | Architecture Section 15 |
| App-private encrypted files and off-thread work | Architecture Sections 9.6 and 9.8; ADR-0011 |
| Capture routes, states, validation, and interruption | Mobile application flow Sections 9, 12, 16, 17, and 24 |
| 25 MB, 50 pages, magic-byte MIME policy | Architecture Section 15.4 |
| Original preservation and explicit confirmation | Product plan Sections 14.4 and 14.5 |
| Record/provenance authority remains separate | ADR-0014 |
| Native dependency/harness disposition | ADR-0002 and M0 evidence |
| Synthetic-only and telemetry constraints | ADR-0007 and engineering data classification |

## Dependencies

- Complete VLT-01/VLT-02 record, manual draft, local repository, production
  route, and validation foundations.
- Accepted OFF-03 SQLCipher/key custody/independent local-file primitive and
  OFF-04 unlocked repository lifecycle.
- M0-compatible scanner, document picker, image picker, FileSystem, and native
  development-client dependencies already transferred to `apps/mobile`.
- Expo SDK 57 first-party `expo-sharing` and a local Expo module for native
  inspection/normalization.
- Node.js 24.18.0, pnpm 11.14.0, a connected physical Android device, and the
  installed iOS Simulator development client.

## Reviewed Decisions

1. **Capture drafts are not record drafts.** Capture metadata and encrypted
   sources live in dedicated V6 tables. No record, version, provenance event,
   Timeline projection, mutation, audit, or server write is created.
2. **Use first-party incoming sharing.** Expo SDK 57 now provides the intended
   config plugin and Router handoff. A community share-intent dependency is not
   justified. Experimental iOS behavior remains explicitly bounded.
3. **Use ImagePicker for direct camera.** VLT-03 needs a one-shot rear-camera
   source, not a persistent custom camera view, so the existing native picker
   boundary is sufficient and avoids adding `expo-camera`.
4. **Content decides type.** Picker MIME and filename values are never trusted
   for acceptance. The native processor validates magic bytes and returns one
   of the four allowed content types.
5. **A local Expo module owns PDF/image inspection.** PDF page count and
   thumbnail rendering plus image orientation normalization must not be
   implemented with filename guesses or JavaScript byte parsing.
6. **Use accepted limits.** One original may not exceed 25 MB; one PDF or
   multi-page capture may not exceed 50 pages. A rejected addition does not
   damage prior draft assets.
7. **Encrypt before persistence.** App-private plaintext is staging-only. The
   original and thumbnail use independent local-file entries and are removed
   from staging in a `finally` path after encryption or failure.
8. **VLT-04 still owns transport encryption semantics.** VLT-03 generalizes
   OFF-03 local protection only. It creates no upload session, wrapped key,
   ciphertext hash contract, multipart state, or server object.
9. **No OCR in VLT-03.** Although the validated native OCR dependency is
   present, invoking or persisting OCR belongs to VLT-06. This package records
   no recognized text.
10. **Interruption is repository state, not UI memory.** SQLCipher V6 stores
    ordered assets and safe processing state. A process restart reopens the
    draft without relying on React Query or component state.
11. **Cancellation is not failure.** Picker/scanner cancellation returns to
    the unchanged draft. Permission denial and validation rejection use safe
    actionable codes without logging URIs, filenames, MIME hints, or content.
12. **Discard is explicit and atomic in intent.** The UI confirms discard,
    removes draft/asset metadata, deletes encrypted originals/thumbnails and
    protected file keys, and verifies no listed artifacts remain.
13. **Production routes remain fixture-free.** Device orchestration is
    development-only and all validation routes must be absent from release
    exports.
14. **Keep free physical-iPhone signing separate and opt-in.** Registered
    builds continue to default to `app.littlearc.mobile` with the iOS Share
    Extension and `group.app.littlearc.mobile`. A Personal Team profile uses
    `com.nishanth.littlearc.dev` and disables only the iOS incoming-share
    extension by default so the main app can be signed and installed locally
    without changing the production identity. An explicit experimental
    override may regenerate the Personal Team profile with its own extension
    identifier and app group after the main-target build passes. Android share
    intent filters remain unchanged, including PDF support.

## Data And Trust Review

| Data | Classification | Treatment |
| --- | --- | --- |
| Capture draft/asset/file IDs, source kind, ordering, state, safe codes | Sensitive/internal | SQLCipher only; opaque IDs; never analytics |
| Original bytes and thumbnails | Restricted child/health | Staging only until independently AES-GCM encrypted; no logs or evidence |
| Original filename, provider URI, picker MIME hint | Restricted/sensitive | Used ephemerally for acquisition only; never persisted or emitted |
| Detected MIME, size, page count, dimensions | Health-adjacent metadata | SQLCipher only; aggregate counts may appear in synthetic evidence |
| Permission/cancel/rejection outcomes | Operational | Allowlisted generic codes only |

- Test fixtures must be purpose-built synthetic documents/images with obvious
  nonmedical content.
- Evidence records device/OS, adapter, counts, safe codes, and outcomes only.
- Capture/share payloads, URIs, filenames, hashes, IDs, OCR text, and original
  or thumbnail bytes never enter logs, analytics, Sentry, documentation, or
  screenshots.
- Sign-out and local-security wipe remove SQLCipher, encrypted capture files,
  thumbnails, and per-file keys.

## Module Status

| Module | Status | Notes |
| --- | --- | --- |
| Plan, research, and authorization boundary | Completed | Reviewed against sources, current code, and Expo SDK 57 |
| Capture policy and SQLCipher V6/V7 repository | Completed | V6 capture metadata, V7 wrapped file keys, ordered resume, and focused tests |
| Encrypted local-file lifecycle | Completed | Independent originals/derivatives, foreground unlock coalescing, bounded preview, cleanup, and wipe |
| Native processor | Completed | Android/iOS content inspection, normalization, thumbnails, and native compilation |
| Scanner/camera/gallery/file adapters | Completed | Serialized adapters with cancel/permission behavior |
| Incoming share adapter | Completed | Expo SDK 57 config, payload hook, and tested Router handoff |
| Personal Team iPhone profile | Completed | Opt-in development identity, extension-off default, scripts, four config tests, and both generated-target checks pass |
| Production routes/components | Completed | Source choice, progress, resume, preview, keep, and discard |
| Automated/native/release validation | Completed | Focused, root, native, release, Doctor, and clean-checkout checks pass |
| Android and iOS Simulator evidence | Completed | Both restart/discard flows pass; agent-captured Pixel gallery/file/PDF/share evidence plus user-attested synthetic scanner/camera/permission checks pass |
| Documentation and evidence | Completed | Prompt-storm remediation, bounded device evidence, deferred physical-iPhone proof, decisions, dashboard, roadmap, and indexes aligned |

## Implementation Plan

1. Add pure capture policy types and validation for source kind, allowed
   signature type, 25 MB size, 50 pages, permission/cancel outcomes, ordered
   draft states, and safe error codes.
2. Add SQLCipher migration V6 and repository functions for capture draft/asset
   create, append, list, reopen, failure-state update, remove, and orphan
   detection. Update marker, migration, upgrade, and wipe tests.
3. Generalize OFF-03 encrypted local-file operations for storing a staged file,
   opening a temporary preview, deleting ciphertext/key/metadata, and cleaning
   partial artifacts. Keep the validation probe on the same public primitive.
4. Add the local Expo capture-processor module with Swift/PDFKit/ImageIO and
   Kotlin/PdfRenderer/BitmapFactory/ExifInterface implementations. Expose one
   asynchronous inspection/normalization operation with stable typed results
   and safe error codes.
5. Install the exact Expo SDK 57 `expo-sharing` dependency, configure bounded
   image/PDF incoming types, add Router native-intent handling, and keep
   unrelated native paths fail-closed.
6. Implement scanner, camera, gallery, document, and incoming-share adapters
   that copy inputs into opaque app-private staging, invoke the processor, and
   always clean source-provider/staging artifacts appropriately.
7. Build the capture orchestration transaction: validate capacity, process,
   encrypt original/thumbnail, insert asset metadata, and roll back files/keys
   when persistence fails.
8. Build production capture routes/components and link them from the record
   management entry. Include permission rationale, processing progress,
   resumable asset list, textual failures, retry, and confirmed discard.
9. Add development-only synthetic fixtures/orchestration that exercises the
   production route, adapter policy, native processor, encrypted files, V6
   repository, restart recovery, rejection, and discard without entering
   release exports.
10. Add focused unit/native/repository/UI tests and release-containment
    canaries, then run typecheck and native prebuild/build early enough to fix
    config or module-linking problems before broader validation.
11. Run root tests, builds, validation, Expo Doctor, clean-checkout proof, diff
    checks, release export scans, and local-security wipe regression.
12. Perform the complete applicable lifecycle on the attached physical Android
    device and iOS Simulator. Record actual device/OS, adapter availability,
    restart behavior, native semantics, logs, and exact hardware limits.
13. Create the VLT-03 evidence dossier, review the final diff, align the plan,
    M3/repository indexes, context map, dashboard, roadmap, ADR-0002/0011 review
    notes, and mark complete only if every required acceptance row passes or is
    explicitly bounded as platform-inapplicable.

Implementation change recorded on 25 July 2026: physical testing exposed
concurrent SecureStore biometric prompts. SQLCipher V7 now stores authenticated
envelopes for the still-independent random file keys, and a domain-separated
foreground wrapping session coalesces unlock requests and clears on app
background. This changes local key custody only; VLT-04 still owns
transport/server key wrapping and upload.

Closure decision recorded on 25 July 2026: the founder accepted VLT-03 on the
requested physical-Android plus applicable iOS-Simulator matrix and deferred
physical-iPhone execution. The deferred row includes hardware camera/scanner,
Secure Enclave behavior, free Personal Team installation, and production Share
Extension/App Group signing. This bounded closure changes no Gate 2 criterion
and does not authorize VLT-04.

## Acceptance Criteria

- Scanner, direct camera, gallery, file/PDF picker, and incoming share each
  reach the same production capture-draft pipeline on a supported target.
- Purpose-specific permission rationale precedes camera/photo access; denial
  remains recoverable and does not damage a draft.
- Cancellation from every native chooser leaves existing draft state unchanged.
- JPEG, PNG, HEIC/HEIF, and PDF are detected from bytes; mismatched extensions,
  MIME hints, empty files, and unsupported formats are rejected safely.
- Files over 25 MB, PDFs over 50 pages, and aggregate captures over 50 pages
  are rejected before durable insertion.
- Image orientation is normalized and image/PDF thumbnails are bounded and
  produced through the native asynchronous processor.
- Plaintext provider/staging artifacts are removed after success or failure.
  Durable originals and thumbnails are independently encrypted with opaque
  names and SQLCipher metadata.
- A process restart reopens the exact ordered capture draft and its safe
  metadata without React state, Query cache, network, record, mutation,
  Timeline, or server authority.
- Adding a second source is atomic from the draft's perspective. A rejected or
  failed addition preserves already accepted assets.
- Explicit discard removes the selected draft, asset metadata, ciphertext,
  thumbnails, and protected file keys without affecting another draft.
- Incoming native paths accept only bounded images/PDFs, route without payload
  data in URLs, and clear handled native payloads.
- UI uses semantic tokens, scrolling layouts, minimum targets, headings,
  accessible labels/live results, textual non-color states, and safe errors.
- Logs, analytics, errors, release bundles, and documentation contain no
  capture bytes, filenames, URIs, IDs, hashes, OCR text, or synthetic fixture
  payload.
- Focused, root, native prebuild/build/export, docs, clean-checkout, physical
  Android, and iOS Simulator checks pass within the recorded boundary.
- Documentation does not claim upload, OCR, record confirmation, Gate 2,
  physical iOS, two-device, low-end Android, real-provider, real-data, pilot,
  or production completion.

## Validation

### Planning Gate

- `./scripts/context/validate-docs.sh`
- `pnpm check:format`
- Plan and research diff review against roadmap, product, architecture, backend
  data model, mobile flow, ADR-0002, ADR-0011, ADR-0014, M0 evidence, VLT-01,
  VLT-02, current code, and Expo SDK 57 primary documentation

Implementation may begin only after this planning gate passes.

### Focused Automated Validation

- `pnpm --filter @littlearc/mobile test`
- `pnpm --filter @littlearc/mobile typecheck`
- `pnpm check:design-system`
- local Expo module Android/iOS native build tests where supported

### Broader Repository And Native Validation

- `pnpm test`
- `pnpm typecheck`
- `pnpm validate`
- `pnpm build`
- `pnpm --filter @littlearc/mobile run doctor`
- `pnpm --filter @littlearc/mobile run native:prebuild`
- Android debug development-client build
- iOS Simulator development-client build
- `./tooling/validate-clean-checkout.sh`
- `git diff --check`

No PostgreSQL migration or API behavior is planned. The existing disposable
database record/RLS suites will be run as regression coverage if broader
validation or the final diff touches shared persistence behavior.

### Device And Simulator Validation

Physical Android must cover:

1. install/launch the current custom development client and enroll/unlock the
   synthetic local-security boundary;
2. scan a multi-page synthetic fixture through the actual camera;
3. capture a direct synthetic image;
4. import multiple synthetic gallery images;
5. import valid image and PDF files;
6. receive a valid file through an actual Android share intent;
7. deny then grant one permission and cancel every chooser without draft loss;
8. reject unsupported, disguised, oversized, and over-page-limit fixtures;
9. force-stop/relaunch offline and resume exact asset ordering/state;
10. add another asset after restart, preview safe thumbnails, explicitly
    discard, and verify metadata/files/keys are absent;
11. inspect native semantics, narrow/dark layout, and LittleArc-process logs;
    and
12. remove temporary reverse rules and fixtures after evidence is recorded.

iOS Simulator must cover:

1. build/install/launch the current custom development client and
   enroll/unlock with simulated Face ID;
2. import synthetic gallery images plus image/PDF files and exercise incoming
   share routing where the Simulator supports it;
3. record safe scanner/direct-camera unavailability as platform capability,
   not physical camera evidence;
4. exercise cancellation, rejection, restart recovery, additional import,
   preview metadata, explicit discard, and wipe;
5. inspect native semantics, narrow/dark/large-text layout, and app logs; and
6. preserve the explicit boundary that Simulator results are not physical-iOS,
   camera, Secure Enclave, extension signing, or store evidence.

## Risks And Controls

| Risk | Impact | Control |
| --- | --- | --- |
| Gate 2 remains open | General M3 breadth is not ready | Keep package authorization explicit; do not start VLT-04+ |
| iOS incoming sharing is experimental | Extension may differ on hardware/signing | Use first-party module, test Simulator safely, retain physical-iOS gate |
| Provider metadata lies | Unsupported/disguised content could enter storage | Detect magic bytes natively and ignore filename/MIME for acceptance |
| PDF work blocks JS or is incomplete | Jank, missing page limits, unsafe previews | Native PdfRenderer/PDFKit inspection and thumbnail boundary |
| Plaintext staging survives failure | Restricted-data remnant | Opaque app-private staging plus mandatory `finally` cleanup and tests |
| File encryption drifts into VLT-04 | Scope/architecture confusion | Reuse local ADR-0011 only; no upload/wrapping/server state |
| Capture draft is mistaken for a record | Unconfirmed authority leaks | Separate V6 tables; no record/provenance/Timeline/mutation |
| Native module breaks clean prebuild | Non-reproducible development client | Local Expo module/autolinking, clean prebuilds, both platform builds |
| Large inputs exhaust memory/storage | Crash or data loss | 25 MB/50-page preflight, free-space check, one-at-a-time processing |
| Validation fixtures enter release | Privacy/security regression | Development route substitution and Android/iOS bundle scans |

## Plan Review And Finalization

The plan was reviewed against the live delivery dashboard, roadmap, M3 index,
product plan, architecture, backend data model, mobile application flow,
ADR-0002, ADR-0011, ADR-0014, M0 native evidence, VLT-01/VLT-02 plans and
evidence, current SQLCipher/local-file/record/mobile code, and Expo SDK 57
primary documentation.

Review findings incorporated before implementation:

1. The prior delivery note blocked VLT-03; this founder request is recorded as
   the named separate authorization without changing Gate 2.
2. The M0 harness proved scanner/pickers/native compilation but explicitly left
   incoming share unresolved. Expo SDK 57 now supplies the first-party path,
   with its iOS experimental limitation retained.
3. Product/core sources require encrypted cached files even before VLT-04.
   VLT-03 therefore generalizes OFF-03 local encryption while reserving upload
   key wrapping and transport for VLT-04.
4. File/PDF validation cannot trust picker metadata. A local native processor
   is required for signatures, PDF page count, orientation, and thumbnails.
5. The architecture requires preprocessing off the JS thread. Native
   ImageIO/PDFKit and BitmapFactory/PdfRenderer avoid JavaScript decoding and
   fragile PDF parsing.
6. “Resumable draft” could have been conflated with VLT-02 form drafts. V6
   capture tables preserve source acquisition only and create no record
   authority.
7. OCR is present in the dependency graph but belongs to VLT-06. VLT-03 never
   invokes it or persists recognized text.
8. The requested matrix is physical Android plus iOS Simulator. The plan
   requires full supported Android adapters and records Simulator camera/share
   capability boundaries without converting them into physical-iOS evidence.

Documentation validation and format checks must pass on this reviewed plan
before production implementation begins.

## Follow-Up

- VLT-04 adds authorized file objects, transport encryption/key wrapping,
  resumable upload, retry, cancellation, and download/decryption.
- VLT-05 adds server-side validation, quarantine, malware checks, and terminal
  processing behavior.
- VLT-06 adds local OCR and consented extraction suggestions separated from
  confirmed facts.
- VLT-07+ connect reviewed sources to record/reminder/Vault behavior.
- Physical iOS incoming-share/camera behavior, extension signing, low-end
  Android performance, complete assistive-technology coverage, and every
  remaining Gate 2/pre-pilot criterion stay open.

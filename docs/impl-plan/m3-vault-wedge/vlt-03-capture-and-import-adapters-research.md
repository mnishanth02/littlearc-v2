# VLT-03 Capture And Import Adapter Research

> **Status:** Reviewed
> **Date:** 2026-07-24
> **Owner:** Engineering
> **Work package:** `VLT-03`

## Summary

The production mobile application already carries the M0-validated document
scanner, document picker, image picker, FileSystem, and ML Kit dependencies.
VLT-03 can reuse the scanner and picker boundaries without copying the M0 probe
into production.

Expo SDK 57 adds first-party incoming-share support to `expo-sharing`, including
an Expo config plugin, Android intent filters, an iOS share extension, Expo
Router `+native-intent.ts` routing, and resolved local payload hooks. It is a
better fit than a community share-intent package, but Expo still classifies the
iOS receiving path as experimental. Physical-iOS acceptance therefore remains
open.

Expo FileSystem provides app-private file operations and immediate access to
DocumentPicker copies. Expo ImageManipulator performs image transformations
asynchronously in native code. Neither provides reliable PDF magic-byte
inspection, page counting, or first-page thumbnail rendering. A narrow local
Expo module is therefore required for uniform image/PDF inspection and
normalization without parsing or decoding originals on the JavaScript thread.

## Stack

| Capability | Selected boundary | Disposition |
| --- | --- | --- |
| Document scan | `react-native-document-scanner-plugin` 2.0.4 | Reuse accepted M0 dependency |
| Direct camera | `expo-image-picker` 57.0.6 camera launcher | Reuse; no persistent camera view is required |
| Photo library | `expo-image-picker` 57.0.6 | Reuse multi-select and limited-library state |
| File/PDF picker | `expo-document-picker` 57.0.1 | Reuse immediate cache-copy behavior |
| Incoming share | `expo-sharing` 57-compatible release | Add first-party Expo dependency and config |
| Temporary files | `expo-file-system` 57.0.1 | Reuse app-private cache/document locations |
| Native inspection/normalization | Local Expo module | Add bounded Android/iOS implementation |
| Local file protection | Accepted OFF-03 AES-256-GCM primitive | Generalize without adding upload behavior |
| Capture metadata | SQLCipher schema V6 | Add capture drafts/assets only |

## Existing Patterns

- Native modules belong in a custom development client; Expo Go is outside the
  accepted boundary.
- SQLCipher owns persistent capture metadata. React state owns only ephemeral
  chooser/progress state.
- Cached files use independent AES-256-GCM keys, immutable AAD, opaque
  filenames, and SQLCipher metadata under ADR-0011.
- VLT-01/VLT-02 records and drafts remain separate from capture drafts. A
  captured source does not become a confirmed record or Timeline fact.
- Development-only orchestration may drive production components, but release
  exports must substitute safe route modules and contain no fixture payloads.

## Integration Points

- `apps/mobile/app/+native-intent.ts` routes recognized incoming-share links to
  the capture screen and fails closed to the ordinary app entry point.
- `apps/mobile/app/(app)/capture/` owns route entry points only.
- `apps/mobile/src/capture/` owns adapter orchestration, validation policy,
  draft repository calls, and production components.
- `apps/mobile/src/local-security/` owns encrypted local-file lifecycle and
  SQLCipher migrations.
- `modules/littlearc-capture-processor/` owns asynchronous Android/iOS magic
  inspection, PDF page count, orientation normalization, and thumbnail output.

## Gotchas

- Expo documents incoming iOS sharing as experimental because the share
  extension opens the main target. Source completion cannot be generalized to
  physical-iOS or store-distribution acceptance.
- Apple permits free Personal Team installation through Xcode, but temporary
  App IDs, device registrations, and provisioning profiles expire after seven
  days. The current limits are ten App IDs, three devices, and three installed
  development apps per device.
- Apple's current iOS capability matrix lists App Groups for free registered
  developers. Disabling LittleArc's extension in its first Personal Team
  profile is therefore a deliberate reduction of signing variables, not a
  claim that free App Groups are categorically unsupported.
- Expo's EAS physical-device workflow requires paid-program credentials.
  LittleArc's free profile is only for direct local Xcode/`expo run:ios`
  compilation and installation; it does not enable EAS distribution,
  TestFlight, or the App Store.
- Picker MIME metadata and filenames are hints only. Acceptance must use native
  magic-byte detection.
- `copyToCacheDirectory` makes a provider result immediately readable but does
  not make it a durable encrypted draft. The source must be validated,
  normalized as applicable, encrypted, and the plaintext staging copy removed.
- ImagePicker multi-select cannot also use its editor. VLT-03 keeps editing and
  normalization in the capture processor.
- A PDF needs native page counting and first-page rendering. Filename
  extensions, MIME strings, and JavaScript regular expressions are not
  sufficient validation.
- The accepted 25 MB object and 50-page limits bound memory and processing.
  VLT-03 must fail before encryption when limits are exceeded and must clean
  partial plaintext/ciphertext in a `finally` path.

## Testing

- Pure policy tests cover source/type/size/page/permission decisions, atomic
  state transitions, cancellation, interruption, and safe error codes.
- SQLCipher tests cover schema V6, draft/asset CRUD, restart recovery, discard,
  orphan cleanup, and sign-out wipe.
- Native tests and development-client runs cover JPEG/PNG/HEIC/PDF signatures,
  orientation, dimensions, 25 MB and 50-page bounds, thumbnails, cancellation,
  and source cleanup.
- Physical Android must exercise every supported acquisition adapter, including
  an actual scanner/camera and Android incoming share.
- iOS Simulator must exercise file/gallery/share routing and safe
  camera/scanner unavailability. It is not physical camera or physical-iOS
  share-extension evidence.

## Open Questions

- Physical-iOS incoming-share behavior, signing, extension provisioning,
  memory pressure, and source-app coverage remain pre-pilot obligations.
- Target low-end Android performance and the complete assistive-technology
  matrix remain Gate 2/pre-pilot obligations.
- VLT-04 must decide whether to wrap/reuse the local per-file key or re-encrypt
  for transport while preserving ADR-0011 and upload AAD semantics.
- VLT-06 owns on-device OCR, source snippets, suggestions, and extraction
  review. VLT-03 must not log or persist recognized text.

## Sources

- Tier 1 project sources: implementation roadmap Section 12, architecture
  Sections 9 and 15, mobile application flow Sections 12, 17, and 24,
  ADR-0002, ADR-0011, ADR-0014, and the M0 native evidence.
- Tier 2 framework source: Expo SDK 57 Sharing documentation,
  <https://docs.expo.dev/versions/v57.0.0/sdk/sharing/>.
- Tier 2 framework source: Expo SDK 57 FileSystem documentation,
  <https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/>.
- Tier 2 framework source: Expo SDK 57 ImagePicker documentation,
  <https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/>.
- Tier 2 framework source: Expo SDK 57 ImageManipulator documentation,
  <https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/>.
- Tier 1 platform source: Apple developer account and Personal Team limits,
  <https://developer.apple.com/help/account/basics/about-your-developer-account/>.
- Tier 1 platform source: Apple supported iOS capabilities by membership,
  <https://developer.apple.com/help/account/reference/supported-capabilities-ios/>.
- Tier 1 platform source: Apple physical-device Developer Mode,
  <https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device>.
- Tier 2 framework source: Expo local native compilation,
  <https://docs.expo.dev/guides/local-app-development/>.

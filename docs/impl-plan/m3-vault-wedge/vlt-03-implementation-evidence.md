# VLT-03 Implementation Evidence

> **Status:** Complete — accepted on the requested physical-Android plus applicable iOS-Simulator boundary; physical-iPhone proof is deferred
> **Evidence date:** 2026-07-25
> **Last updated:** 2026-07-25
> **Owner:** Engineering
> **Milestone:** M3
> **Plan:** [VLT-03 plan](./vlt-03-capture-and-import-adapters-plan.md)
> **Research:** [VLT-03 research](./vlt-03-capture-and-import-adapters-research.md)
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)

---

## Outcome

VLT-03 capture and import adapters are implemented. An enrolled parent can
create or resume a dedicated local capture draft and add scanner pages, a
direct camera image, selected gallery images, selected JPEG/PNG/HEIC/HEIF/PDF
files, or incoming platform-share files.

Accepted sources cross one native processing boundary that detects content
from bytes, enforces the 25 MB and 50-page limits, normalizes image orientation,
creates a bounded thumbnail off the JavaScript thread, and returns only safe
metadata. Originals, normalized images, and thumbnails are encrypted
independently with AES-256-GCM. SQLCipher V7 stores authenticated envelopes for
their random keys; the wrapping key is domain-separated from the protected
SQLCipher key and exists only in a coalesced foreground session. A capture
draft has no record, provenance, Timeline, synchronization, upload, OCR,
suggestion, or confirmation authority.

Automated, clean native-build, release-containment, and iOS Simulator
validation are recorded below. The connected Pixel 8 passed the deterministic
restart/discard lifecycle, multi-image gallery, image/PDF file, actual incoming
share, semantic-tree, log-safety, and cleanup checks. That work also exposed and
closed a repeated-biometric-prompt defect. On 25 July 2026 the founder then
reported that the requested synthetic scanner, direct-camera, permission
denial/grant, and cancellation scenarios also passed on the same Pixel. This
user-attested manual result completes the requested Android adapter row but is
kept distinct from agent-captured logs and screenshots.

An opt-in Personal Team profile now makes the main iOS target buildable under
free Xcode signing with a separate development bundle identifier and no Share
Extension or App Group by default. On 25 July 2026 the founder accepted VLT-03
on the requested physical-Android plus applicable iOS-Simulator matrix and
deferred physical-iPhone execution to the pre-pilot capability matrix.

This evidence does not close Gate 2, authorize `VLT-04` or later M3 breadth,
establish physical-iOS or two-physical-device evidence, approve real data, or
prove low-end Android, live-provider, pilot, or complete
assistive-technology coverage.

## Implemented Boundary

- Production capture entry linked from the record-management experience, with
  a scrollable semantic source chooser, permission rationale, non-color status,
  safe error text, protected draft list, retry, keep, and confirmed discard.
- Scanner, rear-camera, multi-image gallery, multi-file document, and incoming
  Android/iOS share adapters. Picker cancellation leaves the draft unchanged,
  and source controls are serialized so two imports cannot mutate one draft
  concurrently.
- First-party Expo SDK 57 incoming-share integration, bounded Android intent
  types, an iOS share extension, and a Router handoff that recognizes only the
  actual `littlearc://expo-sharing` native path when payloads exist.
- Registered iOS builds retain the production bundle, Share Extension, and App
  Group. An explicit Personal Team mode uses `com.nishanth.littlearc.dev` and
  disables only the iOS incoming-share target by default. Android incoming
  shares, iOS camera/scanner/gallery/file flows, and outbound
  `Sharing.shareAsync()` remain available.
- A local Expo module implemented with Kotlin/PdfRenderer/BitmapFactory/
  ExifInterface and Swift/PDFKit/ImageIO/UIKit. Both platforms inspect and
  derive files away from the JavaScript thread.
- Content-based JPEG, PNG, HEIC/HEIF, and PDF acceptance; native structure
  parsing; 25 MB per-source and 50-page aggregate limits; 4,096-pixel normalized
  images; and 512-pixel JPEG thumbnails.
- Bounded Android provider-stream copying that stops at the size limit instead
  of first consuming an arbitrarily large stream, plus bounds-first sampled
  image decoding that avoids allocating the full-resolution bitmap before the
  4,096-pixel normalization boundary.
- SQLCipher schema V6 `local_capture_drafts` and `local_capture_assets` tables
  with ordered opaque metadata, safe processing state, and no original
  filename, provider URI, picker MIME hint, or content. Schema V7 adds
  authenticated wrapped file keys while retaining nullable legacy rows for
  lazy migration.
- The accepted independent encrypted-file primitive generalized for capture
  original, normalized, and thumbnail purposes. Concurrent local operations
  share one foreground biometric unlock, file keys remain independently
  random, and app backgrounding clears the session and plaintext previews.
  Plaintext staging is removed in success and failure paths.
- Restart recovery that converts an interrupted `processing` checkpoint into
  an editable draft with a safe error, without relying on React state.
- Explicit discard that retains recoverable metadata until ciphertext, key,
  and key-index deletion succeeds, then atomically releases capture references
  and encrypted-file metadata.
- A development-only synthetic native validation route and release canary.
  Production Android and iOS exports substitute the accepted redirect-only
  module and contain no fixture bytes or validation strings.

## Automated And Native Build Evidence

The following checks passed with Node.js 24.18.0 and pnpm 11.14.0:

```sh
pnpm format
pnpm --filter @littlearc/mobile typecheck
pnpm --filter @littlearc/mobile test
pnpm exec vitest run tooling/mobile-release/policy.test.ts
pnpm --filter @littlearc/mobile run doctor
pnpm --filter @littlearc/mobile run native:prebuild
pnpm --filter @littlearc/mobile run native:prebuild:ios:personal
pnpm --filter @littlearc/mobile run native:prebuild:ios:registered
pnpm --filter @littlearc/mobile build
pnpm validate
pnpm test
pnpm build
./tooling/validate-clean-checkout.sh
git diff --check
```

Focused results:

| Surface | Result |
| --- | --- |
| Mobile capture/local-security/config suite | 16 files and 63 tests passed |
| iOS signing-profile tests | 4 registered, Personal Team, override, and invalid-setting tests passed |
| Release-containment policy | 3 tests passed |
| Expo Doctor | 20 of 20 checks passed |
| Clean native prebuild | Android and iOS projects plus CocoaPods generated |
| Personal Team native generation | Main target only; `com.nishanth.littlearc.dev`; no extension or App Group |
| Registered native generation | Main plus share-extension targets; exact production IDs and App Group |
| Native module autolinking | `littlearc-capture-processor` detected on Android and iOS |
| Root validation | 18 of 18 workspace typecheck tasks passed |
| Root tests | 236 passed: 221 tooling/unit and 15 contract |
| Root build | 11 of 11 build tasks passed |
| Android/iOS release exports | 29 Android and 25 iOS files passed containment |
| Clean checkout | Source-only snapshot and 18 uncached typecheck tasks passed |

Native builds also passed:

- Android Pixel-target debug APK:
  `./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a`
  completed 615 tasks (`36` executed, `579` up to date) in 39 seconds after the
  bounds-first decode hardening.
- iOS Simulator development client: a clean signed `xcodebuild` for the
  iPhone 17 Pro Simulator completed successfully. Dependency warnings were
  present, but no LittleArc or capture-processor error occurred.

Expo Doctor initially found that broad root `android/` and `ios/` ignore rules
also hid the local module's Kotlin and Swift source. The ignore rules were
narrowed to the two generated application/harness projects. Doctor also
required `expo-sharing` `~57.0.7`; the dependency and lockfile were updated.
The subsequent 20-check run passed.

The fresh iOS restart validation initially exposed a discard-ordering defect:
encrypted-file metadata was deleted while `local_capture_assets` still held
foreign-key references. The runtime safely stopped without claiming success.
The implementation now removes ciphertext/key material first and performs
capture-reference plus encrypted-file-metadata deletion in one SQLCipher
transaction. Two regression tests pin the successful ordering and verify that
database recovery references remain when protected-material deletion fails.
The complete prepare/terminate/relaunch/resume flow passed after this repair.

Physical Pixel testing then exposed a second defect: one import could present
more than ten biometric prompts. Expo SecureStore creates a native
`BiometricPrompt` for every `requireAuthentication` read, and VLT-03 was
reopening the SQLCipher key and separately reading each original, normalized,
and thumbnail file key. The repair:

- coalesces concurrent unlock work into one foreground local-security session;
- clears that session and decrypted previews when the app backgrounds;
- keeps every file data key independently random;
- derives a domain-separated AES-256 wrapping key from the unlocked SQLCipher
  key and stores authenticated file-key envelopes in SQLCipher V7; and
- lazily migrates a legacy per-file SecureStore key on first access.

Five session-cache regression tests cover concurrent reuse, foreground lock,
failure retry, locking while authentication is pending, and stale
authentication cleanup racing with a newer unlock. The fresh Pixel prepare
flow and the final cold prepare/terminate/resume flow completed without a
prompt storm; the actual incoming-share flow presented one fingerprint request
and then imported the PDF successfully.

No shared PostgreSQL schema, API, worker, server object, or synchronization
contract changed in VLT-03, so a new Aiven migration/integration run is not an
acceptance requirement for this local-only package.

## iOS Simulator Evidence

| Fact | Observed value |
| --- | --- |
| Device | iPhone 17 Pro Simulator |
| Runtime | iOS 26.5 |
| UDID | `7C8183EE-08E8-4F3D-A064-D3C404A10CC9` |
| App | Locally signed LittleArc development client |
| Local schema | SQLCipher V7 |
| Network/data | Local synthetic sources only; no API or provider data |

The Simulator completed:

1. a local-security wipe, synthetic owner/child bootstrap, enrollment, and
   keyed SQLCipher V7 reopen;
2. native PNG processing through signature detection, normalization, bounded
   thumbnail generation, independent protection of original/normalized/
   thumbnail files, and SQLCipher asset persistence;
3. native PDF parsing, page count, first-page thumbnail generation, independent
   original/thumbnail protection, and ordered persistence in the same draft;
4. verification that all five ciphertext files were opaque and did not begin
   with the source PNG or PDF magic bytes;
5. bounded decryption of a protected thumbnail for display;
6. persistence of a synthetic `processing` checkpoint followed by an actual
   application termination;
7. development-client relaunch and safe recovery of the interrupted draft as
   editable with `capture_processing_failed`; and
8. explicit discard followed by verification that capture metadata,
   encrypted-file metadata, protected key envelopes, and ciphertext were
   removed.

The final rendered result was:

`VLT-03 device validation passed · Interrupted draft resumed · safe error
preserved · metadata, keys, and ciphertext discarded`.

The sequence was repeated after the biometric repair and domain-separated
file-key wrapping change. The Simulator again prepared the protected PNG/PDF
checkpoint, survived application termination, resumed, and removed metadata,
key envelopes, ciphertext, and preview material.

The production capture route also rendered its source chooser, rationale,
protected-draft state, scanner/camera/gallery/file actions, and semantic
scrolling layout in light and dark appearances, large text, and increased
contrast without navigation or control loss. A LittleArc-process log scan
found no fatal, uncaught, crash, exception, RCTFatal, app-termination, or
protected-payload canary match. Development-client network-probe connection
errors were present before the LAN Metro connection and are not application
flow failures. iOS Simulator cannot supply a real camera/scanner feed, so
those two hardware adapters are not claimed from this target. System
photo/document-picker presentation and cancellation are covered by adapter
tests; the synthetic native route validates the post-picker processing path
with actual PNG/PDF files.

## Physical Android Evidence

| Fact | Observed value |
| --- | --- |
| Device | Google Pixel 8 (`shiba`) |
| Serial | `3A110DLJH000U7` |
| Android/build | Android 17 / `CP2A.260705.006` |
| Connection | Authorized USB ADB |
| Application | Installed LittleArc development client |
| Local schema | SQLCipher V7 |
| Network/data | Metro USB reverse only; synthetic files; no API reverse |

The connected Pixel completed:

1. fresh synthetic PNG/PDF preparation, native processing, five opaque
   ciphertext checks, thumbnail reopen, and processing-checkpoint persistence;
2. actual force-stop, development-client reload, interrupted-draft recovery,
   and verified metadata/key-envelope/ciphertext discard;
3. a two-image Android photo-picker import from purpose-built synthetic PNGs,
   producing two ordered protected gallery sources;
4. Android photo-picker and file-picker cancellation with the existing draft
   unchanged;
5. image import through the file picker earlier in the run and a final
   synthetic PDF import showing `File picker · PDF · 1 page · 1 KB`;
6. an actual Android `ACTION_SEND` PDF sharesheet selection, one fingerprint
   request, protected `Incoming share · PDF · 1 page · 1 KB` review, and
   confirmed discard;
7. native semantic-tree inspection for the chooser, rationale, source cards,
   progress, keep, and confirmed-discard controls; and
8. a LittleArc-process log scan with no fatal exception, provider URI,
   synthetic filename, protected key name, wrapped-key field, or ciphertext
   match.

The actual sharesheet initially retained Gmail as Android's preferred share
target. Selecting that default created an attachment-only draft but sent
nothing. The draft was identified by the synthetic PDF and timestamp, moved
out of Drafts, and the pre-existing mail was left untouched. Selecting
LittleArc under **Use a different app** then completed the intended share flow.

The camera surface launched and returned a protected JPEG, proving adapter and
post-picker processing execution. Because the physical scene could not be
certified synthetic, that agent-captured result was not accepted as synthetic
evidence; its entire four-source draft was immediately discarded and the
records screen confirmed `No protected capture drafts on this device.`

The founder subsequently completed the manual steps that require physically
aiming the Pixel and reported that the synthetic two-page scanner, synthetic
direct-camera image, explicit camera-permission denial and grant, and
no-shutter cancellation scenarios all worked. This is accepted as
user-attested physical-device evidence. It does not imply that the complete
TalkBack, 200% text, low-end Android, or broader Gate 2 matrix passed.

## Functional And Safety Acceptance

| Acceptance area | Result |
| --- | --- |
| Scanner/camera/gallery/file adapter mapping and cancellation | Focused tests, agent-captured gallery/file, and user-attested synthetic scanner/camera checks pass |
| Incoming-share Router handoff and payload gating | Focused tests and actual Pixel PDF share/discard pass |
| Content type, metadata, 25 MB, and 50-page policy | Passed in focused policy tests |
| Native PNG/PDF process and thumbnail path | Passed on Pixel 8 and iOS Simulator |
| Independent encrypted originals/derivatives and opaque bytes | Passed on Pixel 8 and iOS Simulator |
| SQLCipher V6/V7 ordered capture draft and wrapped-key persistence | Passed in tests, Pixel 8, and iOS Simulator |
| Actual process restart and safe interrupted-state recovery | Passed on Pixel 8 and iOS Simulator |
| Discard metadata/key/ciphertext cleanup | Passed on Pixel 8 and iOS Simulator |
| Foreground biometric prompt coalescing | Five regression tests plus fresh and cold Pixel flows pass; actual share used one prompt |
| Android/iOS production export containment | Passed for both release exports |
| Clean Android/iOS native builds | Passed for Android arm64 and iOS Simulator |
| Physical Android requested adapter flow | Passed; agent-captured automated/gallery/file/share evidence plus user-attested scanner/camera/permission evidence |
| iOS Simulator applicable complete flow | Passed within camera/scanner limits |
| Personal Team iOS native profile | Generated and inspected successfully; physical device not connected |
| Physical iPhone, Secure Enclave, and production Share Extension | Deferred to the pre-pilot physical-device capability matrix; not claimed by VLT-03 |

## Free Personal Team iPhone Profile

LittleArc now has two deterministic iOS signing profiles:

- Registered mode is the default. It uses `app.littlearc.mobile`,
  `app.littlearc.mobile.expo-sharing-extension`, and
  `group.app.littlearc.mobile`.
- Personal Team mode is opt-in. It uses `com.nishanth.littlearc.dev` and
  disables the iOS incoming-share extension, its second signed target, and App
  Group entitlement. The Android incoming-share configuration remains
  unchanged.

After the Apple Account appears as **Personal Team** in Xcode and the iPhone is
connected:

```sh
cd apps/mobile
pnpm run native:prebuild:ios:personal
pnpm run ios:personal
```

Both native-generation profiles were executed during this run. The Personal
Team project contained only the main target, the development bundle ID, and no
App Group entitlement. The registered project was regenerated afterward and
contained both production targets with the expected App Group. No iPhone or
valid code-signing identity was available, so the free profile has not yet
been compiled, installed, or run on a physical iPhone.

Apple currently documents free Personal Team device testing and the 7-day
expiry for its App IDs, devices, and provisioning profiles in
[Developer account overview](https://developer.apple.com/help/account/basics/about-your-developer-account/).
Its current
[Supported capabilities for iOS](https://developer.apple.com/help/account/reference/supported-capabilities-ios/)
also lists App Groups for free registered developers. Therefore an explicit
experimental profile is retained for later:

```sh
pnpm run native:prebuild:ios:personal-share
pnpm run ios:personal:share
```

That experiment is not required for the first main-target test and does not
establish production extension acceptance. Expo still labels iOS incoming
sharing experimental. TestFlight, App Store distribution, EAS
internal/ad-hoc distribution, production identifier management, and durable
release signing remain later paid-program work.

## Deferred Physical-iPhone Follow-Up

When the deferred pre-pilot row is resumed, the manual actions are signing
into Xcode with the free Apple Account,
connecting and trusting an iPhone, enabling Developer Mode, and selecting the
Personal Team for the generated main target if automatic signing does not do
so. The physical run must cover launch, local enrollment/biometrics,
scanner/camera/gallery/file flows, restart/resume/discard, accessibility, and
safe logs. Incoming sharing from another iOS app remains excluded from the
extension-off profile.

The external synthetic Pixel fixtures may still be removed from **Downloads**
and **Pictures → Screenshots**. Protected app drafts and their encrypted
artifacts were already discarded successfully.

Broader Gate 2 obligations remain unchanged: physical iOS/Secure Enclave, a
second physical device and two-device conflict, target low-end Android, the
complete 200% text and TalkBack/VoiceOver matrix, real-provider/real-data
approval, specialist review, signed distribution, and pilot gates.

# Gate 1 Mobile Device and Accessibility Evidence

> **Gate:** Gate 1 — Foundation Is Reproducible
> **Status:** Accepted for the Gate 1 platform matrix
> **Evidence date:** 20 July 2026
> **Last updated:** 20 July 2026
> **Owner:** Engineering
> **Related work:** [`FND-03`](./fnd-03-implementation-evidence.md),
> [`FND-08`](./fnd-08-implementation-evidence.md), and
> [ADR-0002](../../adr/0002-expo-native-development-and-spike-disposition.md)

---

## 1. Acceptance Decision

For Gate 1, the founder accepts the following development-client validation
matrix:

- iOS: iPhone 17 simulator on the designated Mac.
- Android: physical Google Pixel 8 connected through ADB.

This is a deliberate Gate 1 replan. It does not represent a physical-iOS,
TestFlight, Google Play, production-signing, or full pre-pilot device-matrix
claim. Those obligations remain deferred to the parallel pre-pilot gate.

## 2. Environment

| Platform | Target | Observed configuration |
| --- | --- | --- |
| iOS | iPhone 17 simulator | Simulator UDID `99CF7275-CC4E-4B22-B8C0-E5171131D565`; local development client installed and launched |
| Android | Physical Google Pixel 8 (`shiba`) | Serial `3A110DLJH000U7`; Android 17 / API 37; `arm64-v8a`; 1080 x 2400 at density 420 |

Validation used the repository-pinned Node.js 24.18.0 and pnpm 11.14.0
toolchain, the local Expo development server, and synthetic scaffold content
only.

## 3. Development-Client Evidence

| Validation | Result |
| --- | --- |
| iOS native development-client build, install, launch, and Metro render on the iPhone 17 simulator | Pass; the native build completed with zero errors and the LittleArc foundation route rendered |
| `pnpm --filter @littlearc/mobile exec expo run:android --device --no-bundler` against the Pixel 8 | Pass; Gradle reported `BUILD SUCCESSFUL` after 595 tasks, installed the `arm64-v8a` APK, and opened `app.littlearc.mobile/.MainActivity` |
| Physical Android cold launch through the development-client URL | Pass; Android reported `Status: ok`, `LaunchState: COLD`, and a 926 ms total launch time |
| Metro render on both accepted targets | Pass; the iOS and Android clients loaded the current development bundle without a JavaScript or native crash |

The physical Android APK was 161,966,226 bytes with SHA-256
`296396143629041420503d02db7d3d4c7dfcb067ead2af9f33da6c22a218f5e4`.
Upstream native compilation warnings were non-fatal and did not change the
result.

## 4. Accessible Reference-State Evidence

The development-only design-system gallery was exercised on both accepted
targets. The gallery covers scalable typography, primary/secondary/quiet/
destructive/disabled/loading actions, and information/success/attention/
warning/danger/offline banners.

| Validation | Result |
| --- | --- |
| iOS default reference state | Pass; the gallery rendered at the default content size with light appearance and remained navigable |
| iOS maximum accessibility content size plus increased contrast | Pass; `accessibility-extra-extra-extra-large` and increased contrast were observed, long content reflowed vertically, and repeated scrolling kept all content reachable without horizontal loss or a navigation failure |
| Android default reference state | Pass; the physical device rendered the gallery in dark appearance at font scale 1.0 without clipping or a runtime failure |
| Android 200% text plus high text contrast | Pass; the physical device reported font scale 2.0 and high-text-contrast enabled while the app remained renderable |
| Android TalkBack attachment | Pass; Android reported the TalkBack service bound with spoken, haptic, and audible feedback capabilities |
| Android native semantics | Pass; the UI automation tree exposed navigation actions as native buttons with their labels, and the foundation banner as one explicit state-and-message description |
| Deterministic component safeguards | Pass through FND-08 evidence; roles, accessibility states, scalable layouts, 48-point targets, contrast pairs, and explicit non-color state labels are enforced in source and tests |

The Android screen reader was enabled and attached, but this engineering pass
does not claim qualitative review of every spoken utterance by an assistive-
technology user. Physical iOS VoiceOver review also remains a pre-pilot
obligation.

## 5. Evidence Boundaries

Accepted for Gate 1:

- A reproducible iOS simulator development client.
- A reproducible physical Android development client.
- Accessible foundation reference states on that accepted platform matrix.

Still deferred to pre-pilot readiness:

- Physical iOS installation, VoiceOver, signing, TestFlight, and upgrade tests.
- Scanner, OCR, SQLCipher/biometric invalidation, imports, notifications,
  orientation, smallest-phone/tablet coverage, and store-distributed upgrades
  on the required physical-device matrix.
- Accessibility validation with representative users.
- Any test involving real child, participant, household, or medical data.

## 6. Gate Result

**The Gate 1 development-client and accessible-reference-state criteria are
complete under the accepted iOS-simulator plus physical-Android matrix.** This
evidence closes only those two criteria. Gate 1 and M1 remain open until the
seeded cross-household RLS rejection criterion is evidenced or formally
replanned.

## iOS Simulator Parity Follow-Up — 23 July 2026

The current production custom development client was exercised on the iPhone
17 Pro Simulator (`7C8183EE-08E8-4F3D-A064-D3C404A10CC9`) with iOS 26.5. The
landing/status routes and design-system gallery rendered in light, dark,
increased-contrast, and maximum accessibility content-size states. The
reference content retained vertical reflow and reachable actions without a
horizontal-scrolling dependency or navigation failure.

This refresh changes neither the accepted Gate 1 matrix nor the physical-iOS
pre-pilot obligation. See the
[cross-milestone parity dossier](../ios-simulator-parity-validation-evidence.md).

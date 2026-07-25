# ADR-0002: Expo Native Development and Spike Disposition

> **Status:** Accepted
> **Date:** 2026-07-19
> **Owner:** Engineering
> **Review date:** 2026-10-19
> **Supersedes:** None
> **Superseded by:** None
> **Related documents:** [FND-03 evidence](../impl-plan/m1-foundation/fnd-03-implementation-evidence.md), [FND-08 evidence](../impl-plan/m1-foundation/fnd-08-implementation-evidence.md), [Gate 1 mobile evidence](../impl-plan/m1-foundation/gate-1-mobile-device-and-accessibility-evidence.md), [M0 evidence](../core/m0-readiness-and-evidence.md), and [VLT-03 evidence](../impl-plan/m3-vault-wedge/vlt-03-implementation-evidence.md)

---

## Context

The mobile product needs native modules, SQLCipher, biometrics, OCR, and
Unistyles 3. Expo Go cannot represent that dependency graph. M0 proved a pinned
Expo 57/New Architecture setup in a disposable harness, and FND-03 transferred
it to the real application.

## Decision

Build the mobile app with React Native through Expo SDK 57, New Architecture,
Expo Router, Unistyles 3, and custom development clients. Use direct local
`expo run:ios` and `expo run:android` builds for the pilot; EAS and post-pilot
updates remain separate future decisions. Keep the narrow ML Kit core override
while the real mobile dependency graph requires it and checks pass.

Retain `spikes/native-compat` only as reproducible M0 evidence for unresolved
physical-device scenarios. It is not a root workspace, production source, or an
independent architecture authority. Remove its remaining source after required
device evidence is transferred to the real app and the OCR override is reviewed;
Git history and the M0 dossier then retain the historical decision record.

For Gate 1, accept an iOS simulator on the designated Mac and a physical Android
device as the development-client and foundation-accessibility matrix. This
20 July 2026 founder replan does not replace physical iOS, store, signing,
upgrade, or broader native-capability evidence required before pilot use.

Keep registered iOS configuration as the default build profile. For local
physical-iPhone testing before paid-program enrollment, permit an explicit
Personal Team profile with a separate development bundle identifier and the
iOS incoming-share extension disabled. This profile must not mutate the
production application identity or Android share-intent coverage. An
experimental Personal Team extension profile may be generated separately
because Apple's current free-developer capability matrix includes App Groups,
but it does not replace production signing or distribution acceptance.

## Alternatives Considered

- Expo Go: rejected because required custom native modules are unsupported.
- Bare React Native: rejected because Expo configuration and module tooling
  reduce pilot maintenance without preventing native builds.
- EAS from the start: deferred because local Mac builds are proven and account,
  signing, update, and recovery controls are not ready.
- Delete the harness now: rejected because required physical-device evidence is
  still deferred, despite successful real-app prebuild/export checks.

## Consequences

Native development requires Xcode, Android tooling, CocoaPods, and development
clients. The team must keep Expo/RN/native versions compatible and cannot claim
device acceptance from release exports. The harness no longer blocks M1, but
its retirement has an explicit evidence trigger instead of a stale FND-03 gate.
Free Personal Team installs expire after seven days and must be rebuilt; they
cannot be distributed through TestFlight, EAS internal distribution, or the
App Store.

## Validation

The real app passes Expo Doctor, clean prebuild, TypeScript, and Android/iOS
release export. The accepted Gate 1 matrix additionally passes iOS-simulator
and physical-Android development-client execution plus accessible foundation
reference states. Physical iOS, OCR, store distribution, upgrade, and the
broader capability matrix remain named pre-pilot obligations.

The VLT-03 review trigger was exercised on 24 July 2026 when capture required a
narrow production Expo module. Its Kotlin and Swift source lives under
`apps/mobile/modules/littlearc-capture-processor`; generated application-native
projects remain ignored. Clean autolinking/prebuild, native compilation, Expo
Doctor, release containment, and the linked bounded runtime evidence keep this
decision valid. The module does not make the retained M0 harness production
authority.

## Review Triggers

Review by 2026-10-19, or earlier when the device matrix passes, the OCR wrapper
fixes its dependency, Expo/RN is upgraded, EAS is proposed, or a second build
machine/hosted release path becomes necessary.

# ADR-0002: Expo Native Development and Spike Disposition

> **Status:** Accepted
> **Date:** 2026-07-19
> **Owner:** Engineering
> **Review date:** 2026-10-19
> **Supersedes:** None
> **Superseded by:** None
> **Related documents:** [FND-03 evidence](../impl-plan/m1-foundation/fnd-03-implementation-evidence.md), [FND-08 evidence](../impl-plan/m1-foundation/fnd-08-implementation-evidence.md), [M0 evidence](../core/m0-readiness-and-evidence.md)

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

## Validation

The real app passes Expo Doctor, clean prebuild, TypeScript, and Android/iOS
release export. Physical iOS/Android development-client, OCR, accessibility, and
upgrade evidence remains a named Gate 1 or pre-pilot obligation.

## Review Triggers

Review by 2026-10-19, or earlier when the device matrix passes, the OCR wrapper
fixes its dependency, Expo/RN is upgraded, EAS is proposed, or a second build
machine/hosted release path becomes necessary.

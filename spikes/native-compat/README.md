# LittleArc M0 Native Compatibility Harness

This is a disposable Expo 57 development-client harness for `RDY-07`. It is not
the LittleArc application and must never receive personal, participant, medical,
or child data.

## Scope

The harness exercises:

- Expo 57, React Native 0.86, New Architecture, React Compiler, and Unistyles 3
- AES-256-GCM with additional authenticated data
- Expo SQLite with SQLCipher, WAL, and a synthetic migration/write/read path
- LocalAuthentication and biometric-protected SecureStore
- Multi-page document scanning and offline OCR
- PDF/image pickers and deep-link callback shape
- Generic local notifications
- Better Auth Expo client initialization

Remote authentication, incoming OS share extensions, notification token
rotation, signed iPhone installation, and store distribution require external
accounts or physical devices and are not converted into passes by this harness.

## Local commands

Use Node 24.18.0 and pnpm 11.14.0 without changing unrelated global defaults.

```sh
pnpm install --frozen-lockfile
pnpm run doctor
pnpm typecheck
pnpm prebuild
pnpm ios
pnpm android
```

The accepted workflow is local `expo run:ios` / `expo run:android`. Do not add
EAS configuration to this harness during the initial pilot architecture.

The production mobile application now owns this workflow. This harness remains
only for unresolved M0 physical-device evidence and follows the retirement
decision in
[`ADR-0002`](../../docs/adr/0002-expo-native-development-and-spike-disposition.md).

## Evidence procedure

1. Use only synthetic fixtures approved for the probe.
2. Run the probe on the required device/OS.
3. Record package versions, device class, OS, steps, expected and observed
   results, and disposition in the M0 dossier.
4. Record OCR counts and correction/accuracy metrics only; never retain
   recognized content.
5. Classify each result as `accepted-package`,
   `local-expo-module-fallback`, or `blocked` with owner and resolution date.

Generated `ios/` and `android/` directories are intentionally ignored. A clean
prebuild must reproduce them from `app.json` and the exact lockfile.

## OCR package resolution

`@infinitered/react-native-mlkit-text-recognition@5.0.1` still declares
`@infinitered/react-native-mlkit-core@3.1.0`. That core release incorrectly
publishes React 17-era test libraries as runtime dependencies. Upstream core
5.0.0 corrects the package boundary and has no runtime dependency on those test
packages.

The harness therefore applies a narrow pnpm workspace override from ML Kit core
3.1.0 to 5.0.0. Do not add the obsolete test libraries to production, suppress
peer checks globally, or broaden this override. The override is accepted only
while all of these remain green:

- frozen install and `pnpm peers check`;
- Expo Doctor and TypeScript;
- clean Android and iOS prebuilds/builds; and
- the offline OCR fixture/device acceptance test before pilot use.

Remove the override when the text-recognition package publishes a compatible
core dependency. If a future release breaks the checks above, use the documented
direct Vision/ML Kit local Expo-module fallback.

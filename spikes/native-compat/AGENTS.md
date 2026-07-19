# Module Guide: Native Compatibility Harness

## Responsibility

`spikes/native-compat` is retained M0 evidence for Expo native compatibility,
OCR dependency behavior, SQLCipher, AES-GCM, biometrics, and native build
viability. It is not production application code.

## Read Before Modifying

- `docs/IMPLEMENTATION_STATUS.md`
- `docs/core/m0-readiness-and-evidence.md`
- `spikes/native-compat/README.md`

## Architecture Rules

- Preserve source, lockfile, configuration, README, and evidence instructions.
- Generated `node_modules`, `android`, `ios`, `.expo`, and `dist` directories
  remain disposable and ignored.
- Keep the narrow ML Kit override until an ADR-backed replacement passes native
  checks in the real mobile app.
- Do not import harness code into production application packages.
- Retirement requires `FND-03` native configuration transfer, clean app builds,
  any required root override, and an ADR.

## Validation

- Harness checks: `pnpm install --frozen-lockfile`, `pnpm typecheck`,
  `pnpm run doctor`, `pnpm prebuild`, then `pnpm ios` or `pnpm android` when
  native evidence is required.
- Simulator success does not satisfy later physical-device acceptance gates.

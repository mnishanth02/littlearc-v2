# Module Guide: Mobile App

## Responsibility

`apps/mobile` will contain the Expo React Native parent/caregiver application
after `FND-03`. Current source under `src/app`, `src/components`, and `src/theme`
is quarantined prototype material until `FND-08`.

## Read Before Modifying

- `docs/IMPLEMENTATION_STATUS.md`
- `docs/index.md`
- `docs/core/littlearc-architecture-and-tech-stack.md`
- `docs/core/design-system.md`
- `docs/core/m0-readiness-and-evidence.md`
- `docs/impl-plan/roadmap.md`

## Architecture Rules

- Do not treat existing prototype screens, components, or theme files as
  accepted production APIs before `FND-08`.
- Use Expo development/custom clients for native-module work; do not rely on
  Expo Go for accepted native evidence.
- Use synthetic fixtures only. Do not introduce real child, participant, or
  medical document data.
- Keep native configuration transfer aligned with the retained
  `spikes/native-compat` evidence and its retirement conditions.

## Validation

- Root checks: `pnpm check:workspace`, `pnpm typecheck`, and `pnpm validate`.
- Native checks arrive with `FND-03`; physical-device acceptance remains a later
  gate and cannot be replaced by simulator success.

# Module Guide: Mobile App

## Responsibility

`apps/mobile` contains the Expo React Native parent/caregiver application.
`FND-08` accepts the semantic theme and foundation primitives under
`src/components/ui` and `src/theme`; domain UI should arrive with its first
production feature consumer.

## Read Before Modifying

- `docs/IMPLEMENTATION_STATUS.md`
- `docs/index.md`
- `docs/core/littlearc-architecture-and-tech-stack.md`
- `docs/core/design-system.md`
- `docs/core/m0-readiness-and-evidence.md`
- `docs/impl-plan/roadmap.md`

## Architecture Rules

- Use `@littlearc/design-tokens` semantic roles and Unistyles 3 for product UI.
- Do not introduce literal UI colors outside the design-token definitions.
- Keep the component gallery development-only and use synthetic examples.
- Use Expo development/custom clients for native-module work; do not rely on
  Expo Go for accepted native evidence.
- Use synthetic fixtures only. Do not introduce real child, participant, or
  medical document data.
- Keep native configuration transfer aligned with the retained
  `spikes/native-compat` evidence and its retirement conditions.

## Validation

- Root checks: `pnpm check:workspace`, `pnpm typecheck`, and `pnpm validate`.
- Gate 1 uses the founder-approved iOS-simulator plus physical-Android matrix.
  Do not generalize that narrow acceptance to physical iOS, store distribution,
  upgrades, native capability checks, or the broader pre-pilot device matrix.

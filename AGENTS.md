# Repository Guidelines

## Project Structure & Module Organization

- `apps/mobile/src/app/` contains Expo Router screen prototypes; reusable UI and
  domain components live under `apps/mobile/src/components/`.
- `apps/mobile/src/theme/` contains the provisional Unistyles setup.
- `packages/design-tokens/src/` contains shared color, spacing, and typography
  tokens. Export public APIs through `src/index.ts`.
- `docs/IMPLEMENTATION_STATUS.md` is the project delivery dashboard and AI-agent
  entry point.
- `docs/core/` contains foundational product, architecture, design-system, and
  readiness documents.
- `docs/reference/` contains operational and occasional-use reference material.
- `docs/impl-plan/` contains the roadmap, implementation plans, and their
  validation evidence, grouped by milestone.
- `spikes/native-compat/` is the retained M0 Expo development-client harness.
  It is evidence, not production application code. Its generated `ios/`,
  `android/`, `.expo/`, `dist/`, and `node_modules/` directories stay ignored.

The M1 root workspace is scaffolded. Existing mobile and design-token source
files remain quarantined prototypes until their adopt/adapt/discard review in
`FND-08`; do not import them into production application code before that review.

## Build, Test, and Development Commands

Use Node 24.18.0 and pnpm 11.14.0. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm validate
pnpm check:workspace
pnpm check:format
pnpm typecheck
./tooling/validate-clean-checkout.sh
```

Application start/build commands arrive in `FND-03`. For the retained native
harness:

```sh
cd spikes/native-compat
pnpm install --frozen-lockfile
pnpm typecheck
pnpm run doctor
pnpm prebuild
pnpm ios        # or: pnpm android
```

`prebuild` regenerates ignored native projects. Keep the narrow ML Kit override
in `pnpm-workspace.yaml` until an ADR-backed replacement passes native checks.

## Coding Style & Naming Conventions

Use TypeScript with two-space indentation and semicolons. Prefer named exports,
small focused modules, and explicit domain language. React components use
PascalCase filenames (`EmergencyCard.tsx`); functions, variables, and token keys
use camelCase. Expo Router route filenames remain lowercase (`index.tsx`). Do
not bypass semantic design tokens with arbitrary colors or spacing.

## Testing Guidelines

No formal root test framework or coverage threshold exists yet. Every change
must at least pass the checks available in its package. Place future tests near
their subject using `*.test.ts` or `*.test.tsx`. Native-module changes require
clean prebuild/build evidence; simulator success does not replace required
physical-device acceptance.

## Commit & Pull Request Guidelines

History is currently minimal and uses short outcome-oriented subjects, for
example `M0 completed`. Keep commits focused and use an imperative summary with
an optional scope, such as `mobile: add development-client shell`. Pull requests
should explain scope, roadmap/work-package ID, validation performed, risks or
deferred checks, and linked decisions. Include screenshots for UI changes and
device/build evidence for native changes.

## Security & Delivery Status

Use synthetic fixtures only until the pre-real-data gates pass. Never commit
credentials, tokens, participant information, child data, or unredacted medical
documents. Update `docs/IMPLEMENTATION_STATUS.md` whenever work becomes ready,
in progress, complete, blocked, deferred, or retained. Keep each implementation
plan's status header and module-status table aligned with the dashboard.

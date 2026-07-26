# Repository Guide for Codex

## Purpose

LittleArc is a mobile-first pediatric history platform. All M1 foundation work
packages are accepted. Gate 1 still requires its named physical-device and
accessibility evidence before M2 implementation begins.

## Context Loading Protocol

For every non-trivial task:

1. Open `docs/IMPLEMENTATION_STATUS.md` first to confirm the current delivery
   state, next package, blockers, and evidence links.
2. Open `docs/index.md` to choose the smallest relevant set of documents.
3. Read the nearest module-level `AGENTS.md` when working under `apps/`,
   `packages/`, or `spikes/native-compat/`.
4. Use `docs/context-map.yaml` or `./scripts/context/find-context.sh "<query>"`
   for focused context discovery.
5. Read only relevant core docs, implementation plans, ADRs, references, source
   files, and tests. Do not load all of `docs/` by default.
6. Inspect current code and tests before adding patterns or dependencies.

## Source-Of-Truth Hierarchy

When sources conflict, report the conflict instead of silently choosing.

1. Current executable behavior, tests, and committed configuration
2. Accepted ADRs in `docs/adr/`
3. Live delivery state in `docs/IMPLEMENTATION_STATUS.md`
4. Active implementation plans and evidence in `docs/impl-plan/`
5. Core product, architecture, data-model, design, and readiness docs in `docs/core/`
6. Reference docs in `docs/reference/`
7. Templates and archived or superseded material

## Project Structure & Module Organization

- `apps/mobile/app/` contains the accepted Expo Router shell and routes;
  reusable foundation UI lives under `apps/mobile/src/components/ui/`, while
  domain components arrive with their first production consumer.
- `apps/mobile/src/theme/` contains the accepted Unistyles 3 registration and
  accessibility-preference boundary.
- `packages/design-tokens/src/` contains shared color, spacing, and typography
  tokens. Export public APIs through `src/index.ts`.
- `docs/IMPLEMENTATION_STATUS.md` is the project delivery dashboard and AI-agent
  entry point.
- `docs/core/` contains foundational product, architecture, backend data-model,
  design-system, and readiness documents.
- `docs/reference/` contains operational and occasional-use reference material.
- `docs/impl-plan/` contains the roadmap, implementation plans, and their
  validation evidence, grouped by milestone.
- `spikes/native-compat/` is the retained M0 Expo development-client harness.
  It is evidence, not production application code. Its generated `ios/`,
  `android/`, `.expo/`, `dist/`, and `node_modules/` directories stay ignored.
- `.agents/skills/` contains repo-local Codex workflows. Use them when their
  task descriptions match the work.
- `scripts/context/` contains deterministic context lookup and documentation
  governance checks.

The M1 root workspace is scaffolded. `FND-08` reconciled the loose design-system
prototype file by file. Accepted tokens and foundation primitives are production
source; domain components still arrive with their first production consumer.

## Build, Test, and Development Commands

Use Node 26.4.0 and pnpm 11.14.0. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm validate
pnpm check:workspace
pnpm check:format
pnpm check:docs
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

## Documentation Governance

- `docs/IMPLEMENTATION_STATUS.md` is the live delivery dashboard. Update the
  roadmap only when scope, order, dependency, or gate definitions change.
- Create ADRs for important structure, data-handling, security, operational, or
  difficult-to-reverse decisions.
- Store future-session decisions in repository docs, ADRs, or implementation
  plans instead of relying on chat history.
- Keep root and module `AGENTS.md` files as maps and durable constraints, not
  complete project manuals.

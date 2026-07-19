# Module Guide: Shared Packages

## Responsibility

`packages` contains shared LittleArc libraries for contracts, domain rules,
database access, cryptography, authentication, configuration, observability,
test helpers, and design tokens.

## Read Before Modifying

- `docs/IMPLEMENTATION_STATUS.md`
- `docs/index.md`
- `docs/core/littlearc-architecture-and-tech-stack.md`
- Relevant implementation plan under `docs/impl-plan/`
- Relevant ADR when a package decision is difficult to reverse

## Architecture Rules

- Export public APIs through each package's accepted entry point.
- Use `workspace:*` dependencies for internal package edges.
- Do not bypass package manifests with TypeScript path aliases that imitate
  package imports.
- Keep `packages/design-tokens` platform neutral and export the accepted semantic
  contract through `src/index.ts`; application code maps it through platform UI.
- Keep synthetic fixture support in `packages/test-kit`; do not mix fixtures
  with production data paths.

## Validation

- Root checks: `pnpm check:workspace`, `pnpm test:unit`, `pnpm test:contract`,
  `pnpm typecheck`, and `pnpm validate`.
- Add tests next to package behavior as `*.test.ts` when package logic changes.

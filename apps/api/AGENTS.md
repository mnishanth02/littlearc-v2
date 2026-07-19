# Module Guide: API App

## Responsibility

`apps/api` will contain the Fastify API runtime after `FND-03`. It is currently
a registered workspace shell with environment documentation only.

## Read Before Modifying

- `docs/IMPLEMENTATION_STATUS.md`
- `docs/index.md`
- `docs/core/littlearc-architecture-and-tech-stack.md`
- `docs/reference/environment-variable-catalog.md`
- `docs/impl-plan/roadmap.md`

## Architecture Rules

- Keep request and response shapes aligned with `packages/contracts` once
  `FND-04` introduces accepted contracts.
- Keep authentication and authorization policy in `packages/auth`; do not
  duplicate policy logic in route handlers.
- Use `packages/config` for validated runtime configuration when it exists.
- Use synthetic fixtures only until the pre-real-data gates pass.

## Validation

- Root checks: `pnpm test:contract`, `pnpm typecheck`, and `pnpm validate`.
- Do not add deployment, production secrets, or provider credentials in this
  module before the relevant implementation package authorizes them.

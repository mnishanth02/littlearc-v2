# Module Guide: Worker App

## Responsibility

`apps/worker` will contain background job processing after the runtime scaffold
and queue packages are accepted. It is currently a registered workspace shell.

## Read Before Modifying

- `docs/IMPLEMENTATION_STATUS.md`
- `docs/index.md`
- `docs/core/littlearc-architecture-and-tech-stack.md`
- `docs/reference/environment-variable-catalog.md`
- `docs/impl-plan/roadmap.md`

## Architecture Rules

- Keep queue, retry, and persistence behavior aligned with accepted architecture
  and future database plans.
- Use shared packages for configuration, persistence, observability, and domain
  rules instead of worker-local copies.
- Do not process real child, participant, household, or medical document data
  until every pre-real-data gate passes.

## Validation

- Root checks: `pnpm typecheck` and `pnpm validate`.
- Add focused worker tests when real job behavior is introduced.

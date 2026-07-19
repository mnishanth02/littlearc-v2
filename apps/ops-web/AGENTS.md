# Module Guide: Staff Operations Web

## Responsibility

`apps/ops-web` will contain the staff operations web application after its
runtime scaffold is accepted. It is currently a registered workspace shell.

## Read Before Modifying

- `docs/IMPLEMENTATION_STATUS.md`
- `docs/index.md`
- `docs/core/littlearc-complete-product-plan.md`
- `docs/core/littlearc-architecture-and-tech-stack.md`
- `docs/core/design-system.md`

## Architecture Rules

- Keep staff workflows separate from parent/caregiver mobile workflows.
- Use shared contracts, authentication policy, design tokens, and observability
  packages once those APIs are accepted.
- Do not add production support access, real household data, or staff-user
  workflows before the matching gates and implementation plans authorize them.

## Validation

- Root checks: `pnpm check:format`, `pnpm typecheck`, and `pnpm validate`.
- Include screenshots or rendered UI evidence when future ops-web UI changes
  become user-facing.

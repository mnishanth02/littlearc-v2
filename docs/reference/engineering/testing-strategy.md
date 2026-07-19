# Testing Strategy

> **Status:** Active
> **Last updated:** 2026-07-19
> **Owner:** Engineering
> **Applies to:** Root workspace and application/package changes

## Test Layers

| Layer | Purpose | Typical command |
| --- | --- | --- |
| Static policy | Toolchain, boundaries, generated drift, environment, Railway, semantic styles | `pnpm check:workspace` |
| Unit | Pure domain, configuration, observability, token, and tooling behavior | `pnpm test:unit` |
| Contract | OpenAPI/client/API and database integration contracts | `pnpm test:contract` |
| Compile/build | Cross-package types and deployable artifacts | `pnpm typecheck`, `pnpm build` |
| Native | Expo Doctor, clean prebuild, platform build/export, physical device | Package commands plus recorded device evidence |
| Reproducibility | Source-only frozen install and full validation | `./tooling/validate-clean-checkout.sh` |

## Change Expectations

- Run the smallest relevant test first, add a focused regression test for
  changed behavior, then run broader validation in proportion to risk.
- Use real PostgreSQL for RLS and transaction claims. Mocks may test pure logic
  but cannot replace provider semantics.
- Generated files must be reproducible and unedited; drift checks compare them
  with their source.
- Use synthetic, non-sensitive fixtures and leakage canaries.
- Simulator/export evidence does not replace physical-device, accessibility,
  install, upgrade, interruption, or recovery gates.
- Do not mark a package complete when a required command failed or could not run;
  record the exact deferred check and gate.

`pnpm validate` is the current root acceptance command, but work-package plans
may require additional builds, provider integration tests, or manual evidence.

# Environments

> **Status:** Active
> **Last updated:** 2026-07-19
> **Owner:** Engineering
> **Applies to:** Local development and Railway staging
> **Decision:** [ADR-0006](../../adr/0006-railway-singapore-environment-topology.md)

## Environment Contract

| Environment | Data | Configuration owner | Current status |
| --- | --- | --- | --- |
| Local | Synthetic only | Untracked app `.env` copied from `.env.example` | Implemented |
| Staging | Synthetic/test accounts only | Railway staging variables plus `infra/railway/staging` descriptors | Implemented and deployed |
| Production | No traffic or data | Future isolated project, secrets, recovery, domains, and approval | Deferred |

`tooling/environment/variables.mjs` and the
[variable catalog](../environment-variable-catalog.md) own variable names,
classification, and placement. Runtime parsers own required/optional semantics.
The Railway manifest records sources and ownership, never values.

## Rules

- Never point a local or staging client at an unapproved production service.
- Never copy secrets between environments; rotate and scope each independently.
- Keep client-visible configuration intentionally public and server secrets out
  of bundles.
- Do not infer production readiness from staging descriptors or live staging
  health checks.
- Run `pnpm check:environment` and `pnpm check:railway` after configuration
  changes.

Use the [local-development guide](../local-development.md) for setup and the
[staging runbook](../railway-staging-release.md) for hosted release steps.

# Repository Boundaries

> **Status:** Active
> **Last updated:** 2026-07-19
> **Owner:** Engineering
> **Applies to:** Root workspace
> **Decision:** [ADR-0001](../../adr/0001-workspace-and-repository-boundaries.md)

## Authoritative Sources

- `pnpm-workspace.yaml` defines the root workspace globs and narrow override.
- `tooling/boundaries/policy.mjs` defines package names and dependency/import
  rules; package manifests declare actual edges.
- `turbo.json` defines dependency-aware tasks.

## Rules

- Put deployables under `apps/*` and reusable stable APIs under `packages/*`.
- Use named package exports and `workspace:*`; do not use cross-package relative
  imports or root path aliases to bypass a manifest.
- Packages never import applications. Applications never import another
  application. Mobile and staff use contracts, not API/database implementation.
- Keep `@littlearc/domain` free of frameworks and providers.
- Declare external dependencies exactly in the importing package. A production
  dependency needs an actual production consumer.
- Keep spikes outside the root workspace and never import them into production.

## Change Procedure

1. Inspect the affected package's `AGENTS.md`, manifest, exports, and consumers.
2. Add the smallest stable public export and declare its dependency edge.
3. Add or update boundary tests when changing a rule.
4. Run `pnpm check:workspace`, relevant package tests, and `pnpm typecheck`.

Do not silence a boundary failure with a broad exclusion. Change the boundary
only with a reviewed architecture reason and update ADR-0001 if the durable
decision changes.

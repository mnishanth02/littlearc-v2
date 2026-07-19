# ADR-0001: Workspace and Repository Boundaries

> **Status:** Accepted
> **Date:** 2026-07-19
> **Owner:** Engineering
> **Review date:** 2027-01-19
> **Supersedes:** None
> **Superseded by:** None
> **Related documents:** [FND-01 evidence](../impl-plan/m1-foundation/fnd-01-implementation-evidence.md), [repository-boundary note](../reference/engineering/repository-boundaries.md)

---

## Context

LittleArc needs independently runnable mobile, API, worker, and staff surfaces
without duplicating domain contracts or permitting implementation imports across
applications. A small team also needs one reproducible install and validation
entry point.

## Decision

Use one private pnpm/Turborepo workspace containing `apps/*` and `packages/*`.
Applications may consume packages only through declared `workspace:*`
dependencies. Packages cannot depend on applications, applications cannot depend
on other applications, the domain package stays framework-independent, and the
mobile/staff clients use contracts rather than backend/database implementation.
The M0 native harness remains outside the root workspace.

## Alternatives Considered

- Separate repositories: rejected for the foundation because atomic contract,
  client, and application changes would require cross-repository coordination.
- TypeScript path aliases across folders: rejected because they bypass package
  manifests and make undeclared coupling easy.
- One undifferentiated application package: rejected because deployable and
  security boundaries would be implicit.

## Consequences

One lockfile and task graph improve reproducibility and coordinated changes.
Explicit manifests and boundary checks add maintenance, and shared-package
changes can affect several consumers. A new deployable belongs under `apps/`; a
reusable capability belongs under `packages/` only when it has a stable API.

## Validation

`pnpm check:workspace`, `pnpm typecheck`, and the clean-checkout script verify
the declared graph, exact dependency policy, import boundaries, and build order.

## Review Triggers

Review by 2027-01-19, or earlier if independent release cadence, repository
ownership, build time, or access-control needs make the monorepo boundary
materially costly.

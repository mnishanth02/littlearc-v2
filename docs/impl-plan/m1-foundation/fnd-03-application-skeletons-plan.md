# FND-03 Application Skeletons

> **Status:** Completed
> **Owner:** Engineering
> **Started date:** 19 July 2026
> **Last updated:** 19 July 2026
> **Work package:** `FND-03`
> **Depends on:** `FND-01`, `FND-02`
> **Acceptance evidence:** [FND-03 implementation evidence](./fnd-03-implementation-evidence.md)
> **Inputs:** [Implementation roadmap](../roadmap.md),
> [architecture](../../core/littlearc-architecture-and-tech-stack.md),
> [design system](../../core/design-system.md),
> [M0 evidence](../../core/m0-readiness-and-evidence.md), and
> [delivery dashboard](../../IMPLEMENTATION_STATUS.md)

---

## Status Summary

| Module | Status | Evidence |
| --- | --- | --- |
| Mobile Expo runtime | Completed | See implementation evidence |
| API Fastify runtime | Completed | See implementation evidence |
| Worker runtime | Completed | See implementation evidence |
| Staff operations web | Completed | See implementation evidence |
| Root task graph | Completed | See implementation evidence |
| Documentation and evidence | Completed | See implementation evidence |

## 1. Goal and Outcome

`FND-03` turns the registered M1 workspace nodes into bootable application
skeletons. It does not implement household enrollment, authentication,
contracts, database migrations, observability delivery, real staff workflows, or
real data handling.

The observable outcome is:

- `apps/mobile` contains a real Expo development-client application with route
  groups, safe-area support, an error boundary, deep-link configuration,
  environment selection, and a synthetic landing flow.
- `apps/api` contains a Fastify HTTP shell with validated local configuration,
  request IDs, CORS, security headers, Problem Details errors, liveness, and
  readiness.
- `apps/worker` contains a bootable worker process with validated local
  configuration, safe startup logs, heartbeat behavior, and named placeholders
  for retry and dead-letter policy.
- `apps/ops-web` contains a Next.js staff shell with an isolated staff-auth
  placeholder and no direct database dependency.
- Root `pnpm` and Turborepo commands run real package tasks instead of zero-task
  placeholders.
- The accepted M0 Expo/native configuration and narrow ML Kit core override move
  into the root workspace dependency graph.

## 2. Scope Boundaries

### Included

- Application manifests, TypeScript configs, and package scripts for all four
  applications.
- Minimal source code required for local boot, build, and typecheck checks.
- Mobile Expo app config, Metro/Babel config, Expo Router entrypoint, route
  groups, error boundary, linking scheme, and synthetic fixture screen.
- API server factory and CLI entrypoint with health endpoints and RFC
  Problem Details shape.
- Worker CLI entrypoint with typed configuration, heartbeat interval, signal
  handling, and deferred database-backed job startup.
- Staff web App Router shell with local status content and staff-auth placeholder
  copy that does not create a support workflow.
- Environment-catalog alignment for new FND-03-owned runtime variables.
- Documentation updates and validation evidence.

### Excluded

- Real Better Auth configuration, Apple/Google/email OTP lifecycle, and session
  persistence.
- Shared API contracts, generated clients, Zod-to-OpenAPI, and domain kernel
  primitives.
- Drizzle, PostgreSQL migrations, RLS, `pg-boss` database connectivity, and
  durable job processing.
- Staff account search, session revocation, entitlement override, document
  status, or production support actions.
- Design-system prototype adoption or component reconciliation from
  quarantined source.
- Real child, participant, household, or medical document data.
- Physical-device acceptance, release signing, staging deployment, or
  organization-owned provider setup.

## 3. Dependencies and Decisions

`FND-01` supplies the root workspace, exact toolchain pins, boundary policy, and
environment templates. `FND-02` was completed early by delivery direction and
will automatically pick up package scripts added here.

Implementation decisions:

- Use exact versions from the accepted architecture and M0 evidence.
- Keep application-local external dependencies in the app that imports them.
- Use `workspace:*` only for accepted shared-package imports.
- Do not import quarantined mobile prototype files under `apps/mobile/src`.
- Prefer tiny runtime-local config helpers until `packages/config` gains its
  accepted API in a later package.
- Keep the worker runnable without a database URL in local synthetic mode; real
  `pg-boss` connection belongs with database and queue foundations.

## 4. Data, Security, and Privacy

This package uses synthetic status content only. It must not introduce
credentials, child records, household identifiers, participant data, medical
documents, or real support workflows.

Security and privacy controls for this package:

- Public mobile values remain limited to `EXPO_PUBLIC_*`.
- Server and worker secrets stay blank in committed `.env.example` files.
- API errors use Problem Details and do not expose process internals.
- API readiness reports dependency placeholders without pretending database or
  auth checks have passed.
- Worker logs report job names and lifecycle states only, not payload content.
- Staff web remains separated from database packages and exposes no live staff
  action.

## 5. User Experience and Accessibility

The mobile shell should be a product-shaped synthetic landing flow rather than a
marketing page. It should demonstrate app readiness, environment selection,
safe-area layout, and route grouping without committing to final screen APIs.

The staff shell should be operational, sparse, and clearly separate from the
parent mobile flow. It should show local readiness and auth isolation without
enabling support access.

Accessibility expectations:

- Mobile uses `SafeAreaProvider` and route-level accessibility labels.
- Tap targets in the synthetic landing flow are large enough for touch.
- Web shell uses semantic landmarks and headings.
- No fixed-height content should block dynamic text in the initial shells.

## 6. Verification

Focused checks:

- `pnpm --filter @littlearc/mobile typecheck`
- `pnpm --filter @littlearc/mobile build`
- `pnpm --filter @littlearc/api typecheck`
- `pnpm --filter @littlearc/api test`
- `pnpm --filter @littlearc/api build`
- `pnpm --filter @littlearc/worker typecheck`
- `pnpm --filter @littlearc/worker build`
- `pnpm --filter @littlearc/ops-web typecheck`
- `pnpm --filter @littlearc/ops-web build`
- `pnpm check:workspace`
- `pnpm check:format`
- `pnpm typecheck`
- `pnpm validate`

Native checks:

- `pnpm --filter @littlearc/mobile doctor`
- `pnpm --filter @littlearc/mobile run native:prebuild`

Physical iOS and Android device acceptance remains deferred and must not be
reported as complete from this package unless it is actually performed.

## 7. Delivery Slices

1. Write this package brief and mark `FND-03` in progress.
2. Add API and worker Node skeletons with focused tests where practical.
3. Add staff web Next.js skeleton and production build.
4. Add mobile Expo development-client skeleton and accepted native config.
5. Transfer the narrow ML Kit core override into the root workspace.
6. Run focused validation, then root validation.
7. Record implementation evidence and update the delivery dashboard.

## 8. Definition of Done

`FND-03` is complete when:

- All four app shells have real dev, build, and typecheck scripts.
- API liveness and readiness are test-covered through Fastify injection.
- Worker startup and heartbeat behavior are test-covered without a live
  database.
- Mobile Expo configuration contains the accepted native plugins and SDK pins.
- The root lockfile includes the real app dependency graph.
- Root validation passes with non-zero application task participation.
- Evidence documents exact checks run and any deferred gates.
- The delivery dashboard links the accepted plan and evidence.

## 9. Risks and Residual Obligations

| Risk | Control | Residual obligation |
| --- | --- | --- |
| Native dependency drift from M0 | Use accepted exact pins and run Expo Doctor | Physical devices and native builds remain later acceptance evidence |
| Misleading readiness claims | Report placeholder dependencies as configured, not connected | Real auth, database, queue, and storage checks arrive later |
| Prototype source accidentally becomes production API | Do not import quarantined mobile/design-token files | `FND-08` performs file-by-file reconciliation |
| Worker logs leak data in future jobs | Establish safe lifecycle-only logging now | `FND-07` adds observability allowlists and canaries |
| Staff shell implies support access | Keep auth as isolated placeholder and no data dependencies | Real staff actions require staff auth, masking, purpose codes, and audit |

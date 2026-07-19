# FND-06 Railway Environment Skeleton

> **Status:** Completed
> **Owner:** Engineering
> **Started date:** 19 July 2026
> **Last updated:** 19 July 2026
> **Work package:** `FND-06`
> **Depends on:** `FND-01`, `FND-02`, `FND-03`, `FND-04`, `FND-05`
> **Acceptance evidence:** [FND-06 implementation evidence](./fnd-06-implementation-evidence.md)
> **Inputs:** [Implementation roadmap](../roadmap.md),
> [architecture](../../core/littlearc-architecture-and-tech-stack.md),
> [environment catalog](../../reference/environment-variable-catalog.md), and
> [delivery dashboard](../../IMPLEMENTATION_STATUS.md)

---

## Status Summary

| Module | Status | Evidence |
| --- | --- | --- |
| Package brief and staging-only scope | Completed | This plan |
| Railway staging service descriptors | Completed | See implementation evidence |
| Staging variable and resource manifest | Completed | See implementation evidence |
| API and staff health check paths | Completed | See implementation evidence |
| Staging release path documentation | Completed | See implementation evidence |
| Production environment skeleton | Deferred | Explicit founder direction to skip production for now |
| Documentation and evidence | Completed | See implementation evidence |

## 1. Goal and Outcome

`FND-06` establishes a source-controlled Railway environment skeleton for
staging only. The original roadmap includes both staging and production, but the
accepted package scope for this run intentionally skips production until the
founder reopens it.

The observable outcome is:

- `infra/railway/staging` contains Railway config-as-code descriptors for the
  API, worker, and staff web shells.
- The staging manifest records required services, PostgreSQL, buckets,
  region, data policy, and variable ownership without committing secrets,
  project IDs, service IDs, bucket credentials, domains, or database URLs.
- API and staff web expose Railway-compatible `/health/live` and
  `/health/ready` endpoints.
- Railway staging is provisioned and validated once authenticated CLI access is
  available.
- A deterministic validator fails if production descriptors appear during the
  staging-only scope, if variables contain values, or if service configs drift.
- The release path documents manual staging setup, explicit migration
  execution, deploy order, and evidence capture.

## 2. Scope Boundaries

### Included

- Staging-only Railway service descriptors for:
  - `@littlearc/api`
  - `@littlearc/worker`
  - `@littlearc/ops-web`
- Staging resource placeholders for:
  - PostgreSQL
  - Private document bucket
  - PITR/logical recovery bucket
- Staging variable manifest with public, sensitive, and secret
  classifications.
- Railway health paths for API and staff web.
- Root validation script and focused tests for the staging skeleton.
- Documentation updates, implementation evidence, and delivery dashboard
  alignment.

### Excluded

- Production Railway project, production services, production database,
  production buckets, production secrets, and production domains.
- Railway project IDs, service IDs, linked CLI metadata, real domains, or
  credentials in repository files.
- Real child, participant, household, medical document, production support, or
  pilot data.
- Automatic migration execution from API, worker, or replica startup.
- Object storage adapter implementation and encrypted upload workflows.
- Better Auth runtime integration, staff passkeys, sessions, and household
  authorization.
- Continuous monitoring, Sentry/PostHog delivery, and canary leakage checks;
  those belong to `FND-07`.

## 3. Dependencies and Decisions

`FND-03` supplies deployable application shells. `FND-04` supplies `/v1`
contract metadata. `FND-05` supplies the reviewed database migration and
readiness metadata. This package wires those shells to a staging deployment
contract without claiming live data-plane behavior.

Implementation decisions:

- Use Railway config-as-code JSON files so service build, start,
  healthcheck, restart, and watch settings are reviewable in source.
- Keep Railway service root directories at the repository root because this is
  a shared pnpm monorepo.
- Use one Railway config file per deployable service and configure the file
  path in Railway service settings.
- Keep worker deployment process-only for now; no HTTP healthcheck is exposed
  until a protected operations endpoint exists.
- Treat migrations as an explicit release step using the FND-05 migration role.
- Reject production Railway descriptors while the accepted FND-06 scope is
  staging only.

## 4. Data, Security, and Privacy

Staging remains synthetic/test-account only. Repository files may contain names,
classes, owners, command strings, health paths, and placeholders only.

Security controls for this package:

- `.railway/` is ignored because local Railway CLI link metadata can contain
  project identifiers.
- Secret and sensitive variables are documented in manifests without values.
- API and worker continue to treat object storage as deferred and do not open
  object storage connections.
- API readiness reports foundation metadata without asserting a live database
  connection.
- Production setup is absent by design.

## 5. Verification

Focused checks:

- `pnpm check:railway`
- `pnpm exec vitest run tooling/railway`
- `pnpm --filter @littlearc/api test`
- `pnpm --filter @littlearc/api typecheck`
- `pnpm --filter @littlearc/worker test`
- `pnpm --filter @littlearc/worker typecheck`
- `pnpm --filter @littlearc/ops-web typecheck`
- `pnpm --filter @littlearc/ops-web build`

Broad checks:

- `pnpm check:workspace`
- `pnpm check:format`
- `pnpm check:docs`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm validate`
- `git diff --check`
- `./tooling/validate-clean-checkout.sh`

Live Railway deployment verification is recorded in the implementation evidence
after authenticated Railway CLI setup became available.

## 6. Delivery Slices

1. Write and validate this package brief; mark `FND-06` in progress.
2. Add staging-only Railway service descriptors and resource manifest.
3. Add API and staff web health endpoints required by Railway.
4. Add local validation for staging descriptor drift, variable values, and
   production-scope leakage.
5. Update release documentation and environment references.
6. Run focused validation, then broad validation.
7. Provision and validate Railway staging once authenticated CLI access is
   available.
8. Record implementation evidence and update the delivery dashboard.

## 7. Definition of Done

`FND-06` is complete for the accepted staging-only scope when:

- Staging service descriptors exist for API, worker, and staff web.
- Staging resource placeholders exist for PostgreSQL, private document bucket,
  and recovery bucket.
- Staging variable ownership and rotation responsibilities are documented
  without values.
- API and staff web expose Railway health endpoints.
- A deterministic local check validates the staging-only Railway skeleton.
- Production setup is explicitly deferred and absent from committed Railway
  descriptors.
- Evidence records validation commands and live Railway staging provisioning.
- The delivery dashboard links the accepted plan and evidence.

## 8. Risks and Residual Obligations

| Risk | Control | Residual obligation |
| --- | --- | --- |
| Source descriptors differ from Railway dashboard settings | Keep config-as-code files and release checklist | Re-check Railway config before each staging release |
| Production isolation is not proven in this package | Reject production descriptors locally | Reopen a separate production setup package before real-data gates |
| Object bucket placeholders imply upload support | Keep storage checks deferred | Implement storage adapters and canaries in later packages |
| Worker process lacks protected heartbeat endpoint | Use lifecycle logs only | Add protected operations heartbeat in later ops package |
| Migration execution is manual | Document explicit release step | Keep migrations out of app startup and record each hosted run |

# FND-06 Implementation Evidence

> **Work package:** `FND-06`
> **Status:** Completed
> **Evidence date:** 19 July 2026
> **Last updated:** 19 July 2026
> **Toolchain:** Node.js 24.18.0, pnpm 11.14.0
> **Plan:** [FND-06 package plan](./fnd-06-railway-environment-skeleton-plan.md)

---

## 1. Implemented Staging Skeleton

`FND-06` implements the accepted staging-only Railway skeleton:

- `infra/railway/staging/api.railway.json`: API service build, start,
  healthcheck, restart, and watch settings.
- `infra/railway/staging/worker.railway.json`: worker service build, start,
  restart, and watch settings without an HTTP healthcheck.
- `infra/railway/staging/ops-web.railway.json`: staff web build, start,
  healthcheck, restart, and watch settings.
- `infra/railway/staging/variables.manifest.json`: staging service/resource
  manifest with synthetic-only data policy, Singapore region, public/sensitive
  /secret classification, and no values.
- `tooling/railway`: deterministic local validation for the staging skeleton.
- `apps/api`: added `/health/live` and `/health/ready` aliases for Railway
  while retaining `/live` and `/ready`.
- `apps/ops-web`: added `/health/live` and `/health/ready` route handlers.
- `.gitignore`: ignores `.railway/` local link metadata.

Production Railway files are intentionally absent for this package.

## 2. Validation Results

All commands below ran from the repository root with Node.js 24.18.0 and pnpm
11.14.0.

| Validation | Result |
| --- | --- |
| `pnpm check:railway` | Pass; 3 services, 1 PostgreSQL, 2 buckets |
| `pnpm exec vitest run tooling/railway` | Pass; 3 Railway policy tests |
| `pnpm --filter @littlearc/api test` | Pass; 6 Fastify injection tests |
| `pnpm --filter @littlearc/api typecheck` | Pass |
| `pnpm --filter @littlearc/worker test` | Pass; 2 worker lifecycle tests |
| `pnpm --filter @littlearc/worker typecheck` | Pass |
| `pnpm --filter @littlearc/ops-web typecheck` | Pass |
| `pnpm --filter @littlearc/ops-web build` | Pass; `/health/live` and `/health/ready` dynamic routes built |
| `pnpm check:workspace` | Pass; 26 tooling tests, boundaries, environment templates, Railway skeleton |
| `pnpm check:format` | Pass; Biome and Markdown |
| `pnpm check:docs` | Pass |
| `pnpm typecheck` | Pass; tooling plus package/application typechecks |
| `pnpm test` | Pass; 58 total tests across tooling, domain, database, worker, API, and contracts |
| `git diff --check` | Pass |
| `pnpm build` | Pass; domain, contracts, database, API, worker, mobile export, and ops-web build |
| `pnpm validate` | Pass |
| `./tooling/validate-clean-checkout.sh` | Pass in a 227-file source-only snapshot |

Clean-checkout install still prints the known non-fatal `sharp@0.34.5`
source-build message, then exits successfully and completes validation.

## 3. Evidence Boundaries

Completed in this package:

- Staging-only Railway service descriptors are source-controlled.
- Staging variable and resource requirements are documented without values.
- API and staff web expose Railway-compatible health endpoints.
- Railway staging project `littlearc-staging` is provisioned with staging app
  services, managed PostgreSQL, document bucket, and recovery bucket.
- The FND-05 foundation migration is applied to staging PostgreSQL with the
  committed checksum.
- API, worker, and staff web deploy successfully to Railway staging.
- Local validation fails closed for production descriptors, committed variable
  values, missing services, and service config drift.
- Production setup is explicitly deferred.

Not claimed by this package:

- Production Railway project, production services, production database,
  production buckets, production secrets, or production domains.
- PostgreSQL PITR verification, backup/restore drills, bucket write canaries, or
  object recovery drills.
- Real user, child, household, participant, or medical document data.
- Production Railway isolation, production readiness, or real-data approval.

## 4. Live Railway Evidence

The Railway CLI was installed and authenticated after the initial source
skeleton was completed. Live staging provisioning then completed in the
`littlearc-staging` project.

| Railway check | Result |
| --- | --- |
| Project/environment | `littlearc-staging` with `staging`; Railway-created empty `production` environment has no resources |
| Services | `littlearc-api-staging`, `littlearc-worker-staging`, `littlearc-ops-web-staging`, and managed PostgreSQL service `Postgres` |
| Buckets | `littlearc-documents-staging` and `littlearc-recovery-staging` |
| PostgreSQL | `SUCCESS`; one running replica in Singapore region with ready volume |
| Variables | Manifest keys present for API, worker, and ops-web; secret values were not printed or committed |
| Migration | `0001_fnd_05_database_foundation` applied with checksum `74b4199204708f0e2e77a1c62293de81b0ac82359020fe17f58cb34c2d89f83b` |
| API deploy | `SUCCESS`; running replica; `https://littlearc-api-staging-staging.up.railway.app` |
| Worker deploy | `SUCCESS`; running replica; lifecycle logs report staging, configured queue mode, and migration version |
| Staff web deploy | `SUCCESS`; running replica; `https://littlearc-ops-web-staging-staging.up.railway.app` |
| API health | `/health/live`, `/health/ready`, `/v1`, and `/v1/openapi.json` returned HTTP 200 |
| Staff web health | `/health/live` and `/health/ready` returned HTTP 200 |

The API readiness endpoint still reports database connection as deferred by
design; application startup does not run migrations or open a database
connection in this foundation package. The worker reports `queue="configured"`
because staging `DATABASE_URL` is present, but it still only emits lifecycle
metadata in the current skeleton.

## 5. Completion Decision

**Decision: COMPLETE for the accepted staging-only FND-06 scope.** The source
tree now contains staging Railway service descriptors, a classified staging
variable/resource manifest, Railway-compatible health endpoints for the API and
staff web shells, release documentation, local drift checks, focused tests, root
validation, live staging Railway provisioning evidence, hosted migration
evidence, successful staging deployments, and an explicit production deferral.

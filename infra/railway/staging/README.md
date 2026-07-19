# Railway Staging Skeleton

> **Status:** FND-06 staging skeleton
> **Last updated:** 2026-07-19
> **Owner:** Engineering

This folder defines the staging-only Railway skeleton for LittleArc. Staging is
synthetic/test-account only and must not contain real household, participant,
child, medical, credential, or production support data.

## Services

| Service | Railway config file | Runtime command | Health check |
| --- | --- | --- | --- |
| API | `infra/railway/staging/api.railway.json` | `pnpm --filter @littlearc/api start` | `/health/ready` |
| Worker | `infra/railway/staging/worker.railway.json` | `pnpm --filter @littlearc/worker start` | Railway process restart policy only |
| Staff web | `infra/railway/staging/ops-web.railway.json` | `pnpm --filter @littlearc/ops-web start` | `/health/ready` |
| PostgreSQL | Railway managed PostgreSQL | Explicit release migration step | Checked by API readiness in later slices |
| Private document bucket | Railway bucket | S3-compatible adapter in later slices | Placeholder only in FND-06 |
| PITR/recovery bucket | Railway PostgreSQL PITR plus recovery bucket | Manual recovery runbook in later slices | Placeholder only in FND-06 |

## Railway Setup Notes

Create a dedicated Railway project named `littlearc-staging` in the Singapore
region when using the dashboard or CLI. Add only staging services and staging
resources to that project.

For each GitHub-backed service, keep the root directory at the repository root
and set the Railway config file path to the matching file in this folder:

- `/infra/railway/staging/api.railway.json`
- `/infra/railway/staging/worker.railway.json`
- `/infra/railway/staging/ops-web.railway.json`

Apply variables from `variables.manifest.json` in Railway's staging environment
store. Secret and sensitive values are intentionally not present in the
repository.

## Release Path

1. Confirm the source branch has passed `pnpm validate`.
2. Confirm `pnpm check:railway` passes.
3. Confirm the staging Railway project has API, worker, staff web, PostgreSQL,
   private document bucket, and recovery bucket resources.
4. Set or rotate staging variables from the manifest without copying values into
   the repository or logs.
5. Run the FND-05 migration as an explicit release step against the staging
   PostgreSQL database using the migration role.
6. Deploy the API service and verify `/health/live` and `/health/ready`.
7. Deploy the worker service and verify lifecycle logs contain only safe
   metadata.
8. Deploy the staff web service and verify `/health/live` and `/health/ready`.
9. Record Railway deployment URLs, source commit, migration version, and
   validation evidence in the package evidence document.

Production setup is intentionally absent from this package.

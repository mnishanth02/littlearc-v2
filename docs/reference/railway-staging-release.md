# Railway Staging Release

> **Status:** FND-06 staging runbook
> **Last updated:** 2026-07-19
> **Owner:** Engineering
> **Related work:** [`FND-06`](../impl-plan/m1-foundation/fnd-06-railway-environment-skeleton-plan.md)

This runbook describes the source-controlled staging release path for Railway.
It does not create or authorize production infrastructure.

## Preconditions

- The source branch has passed `pnpm validate`.
- `pnpm check:railway` passes.
- The Railway project is dedicated to staging and uses the Singapore region
  identifier `asia-southeast1-eqsg3a`.
- The staging environment contains only synthetic/test accounts.
- No production data, production credentials, child data, participant data, or
  unredacted medical documents are used.

## Service Setup

Create these staging services/resources in the `littlearc-staging` Railway
project:

| Name | Kind | Config source |
| --- | --- | --- |
| `littlearc-api-staging` | Web service | `/infra/railway/staging/api.railway.json` |
| `littlearc-worker-staging` | Worker service | `/infra/railway/staging/worker.railway.json` |
| `littlearc-ops-web-staging` | Web service | `/infra/railway/staging/ops-web.railway.json` |
| `Postgres` | PostgreSQL | Railway managed resource |
| `littlearc-documents-staging` | Bucket | Railway bucket |
| `littlearc-recovery-staging` | Bucket | Railway bucket |

Keep the repository root as the root directory for each service because the
deployables share workspace packages. Mirror the source-controlled config files
into Railway service settings before deploying. If GitHub-backed deploys are
enabled later, set each service's Railway config file path to the matching file
above.

## Variables

Use `infra/railway/staging/variables.manifest.json` as the variable checklist.
Secret and sensitive values belong only in Railway's staging variable store.
Never paste values into repository files, screenshots, logs, tickets, or
evidence documents.

## Release Steps

1. Build and validate locally with `pnpm validate`.
2. Run `pnpm check:railway`.
3. Confirm the staging PostgreSQL, private document bucket, and recovery bucket
   exist.
4. Set or rotate staging variables from the manifest.
5. Run the FND-05 migration explicitly against staging PostgreSQL.
6. Deploy `littlearc-api-staging`.
7. Verify API `/health/live`, `/health/ready`, `/v1`, and `/v1/openapi.json`.
8. Deploy `littlearc-worker-staging`.
9. Verify worker lifecycle logs contain only code, environment, migration
   version, queue mode, and policy metadata.
10. Deploy `littlearc-ops-web-staging`.
11. Verify staff web `/health/live` and `/health/ready`.
12. Record the source commit, migration version, Railway deployment URLs,
   validation commands, and any deferred checks in the FND-06 evidence doc.

## Current Staging URLs

| Service | URL |
| --- | --- |
| `littlearc-api-staging` | `https://littlearc-api-staging-staging.up.railway.app` |
| `littlearc-ops-web-staging` | `https://littlearc-ops-web-staging-staging.up.railway.app` |

Do not record Railway service IDs, project IDs, database URLs, bucket
credentials, or variable values in this repository.

## Rollback

Use Railway's deployment history to redeploy the last known-good staging
deployment. If the database migration ran and must be reverted, stop the API and
worker first, then execute the reviewed rollback or restore procedure recorded
with that migration. No automatic rollback is introduced in FND-06.

## Deferred Production Work

Production Railway setup is skipped in the current FND-06 scope. It must be
planned separately before real-data gates because production needs isolated
projects, production secrets, PITR evidence, backup/recovery evidence, domains,
provider credentials, access review, and release approval.

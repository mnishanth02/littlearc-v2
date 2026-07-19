# ADR-0006: Railway Singapore Environment Topology

> **Status:** Accepted
> **Date:** 2026-07-19
> **Owner:** Engineering
> **Review date:** 2026-10-19
> **Supersedes:** None
> **Superseded by:** None
> **Related documents:** [FND-06 plan](../impl-plan/m1-foundation/fnd-06-railway-environment-skeleton-plan.md), [FND-06 evidence](../impl-plan/m1-foundation/fnd-06-implementation-evidence.md), [staging runbook](../reference/railway-staging-release.md)

---

## Context

The foundation needs a low-operations staging environment near expected users,
with private service connectivity and reproducible application configuration.
Production custody, recovery, and real-data approvals are not ready.

## Decision

Use Railway Singapore for the initial hosted topology. Keep API, worker, staff,
PostgreSQL, document bucket, and recovery bucket resources isolated by
environment. FND-06 implements staging only with synthetic data. Production is
not implied by the descriptors and requires a separate approved package before
real-data gates.

## Alternatives Considered

- Self-managed cloud infrastructure: rejected because operational burden is too
  high for the pilot team.
- One shared staging/production project: rejected because credentials, data, and
  blast radius must be isolated.
- Provision production during FND-06: deferred by explicit product direction and
  missing custody/recovery approvals.

## Consequences

Staging is inexpensive and reproducible, but Railway is an initial provider
concentration and backup risk. Production needs separate secrets, access review,
PITR/restore evidence, domains, processors, and release approval.

## Validation

Source-controlled descriptors, manifest policy, health/readiness checks, live
staging deployments, migration evidence, and `pnpm check:railway` validate only
the staging decision.

## Review Triggers

Review by 2026-10-19, or earlier before production provisioning, real-data use,
provider-region change, material cost growth, or recovery requirements.

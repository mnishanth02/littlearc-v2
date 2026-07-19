# FND-04 Implementation Evidence

> **Work package:** `FND-04`
> **Status:** Completed
> **Evidence date:** 19 July 2026
> **Last updated:** 19 July 2026
> **Toolchain:** Node.js 24.18.0, pnpm 11.14.0
> **Plan:** [FND-04 package plan](./fnd-04-contracts-and-domain-kernel-plan.md)

---

## 1. Implemented Contract and Domain Kernel

`FND-04` established the first production-shaped shared contract and domain
kernel packages:

- `packages/domain`: framework-independent primitives for UUIDv7 IDs,
  normalized UTC timestamps, revisions, opaque cursors, idempotency keys,
  mutation IDs, household roles, capabilities, consent purposes, audit actions,
  record categories, source types, and confirmation states.
- `packages/contracts`: Zod schema source, OpenAPI 3.1 generation, generated
  OpenAPI TypeScript paths, mobile/staff client factories, contract metadata,
  and a first breaking-contract compatibility guard.
- `apps/api`: `/v1` contract metadata and `/v1/openapi.json` routes served from
  the shared contracts package while preserving FND-03 `/live` and `/ready`.
- `apps/mobile`: type-level compile integration with the generated mobile
  client boundary without importing backend implementation code.
- `apps/ops-web`: type-level compile integration with the generated staff
  client boundary and no direct database dependency.

Root generated-output drift now includes the contracts generator, so CI reruns
OpenAPI/client generation and fails if committed artifacts drift.

## 2. Contract Scope

The first `/v1` surface intentionally exposes contract metadata only:

- `GET /v1`
- `GET /v1/openapi.json`

The generated OpenAPI document also includes reusable components for Problem
Details, pagination, household/child identifiers, consent events, audit events,
record descriptors, and sync mutation envelopes. Future product routes remain
reserved by resource group and owner; they are not implemented or represented
as live CRUD behavior in this package.

## 3. Breaking-Contract Guard

`packages/contracts/baseline/openapi-v1-baseline.json` is the first reviewed
`/v1` baseline. Contract tests compare the generated OpenAPI document against
that baseline and detect removed paths, removed methods, and removed response
codes.

This is the initial guard for `FND-04`. Later packages may expand the guard for
schema-level compatibility once product routes exist.

## 4. Validation Results

All commands below ran from the repository root with Node.js 24.18.0 and pnpm
11.14.0.

| Validation | Result |
| --- | --- |
| `pnpm install --frozen-lockfile=false` | Pass; lockfile updated for FND-04 contract tooling |
| `pnpm --filter @littlearc/contracts generate` | Pass; OpenAPI JSON, OpenAPI TS paths, and first baseline generated |
| `pnpm --filter @littlearc/domain typecheck` | Pass |
| `pnpm --filter @littlearc/domain test` | Pass; 9 domain primitive/policy tests |
| `pnpm --filter @littlearc/contracts typecheck` | Pass |
| `pnpm --filter @littlearc/contracts test:contract` | Pass; 7 contract and compatibility tests |
| `pnpm --filter @littlearc/api test` | Pass; 4 Fastify injection tests including `/v1` metadata and OpenAPI |
| `pnpm --filter @littlearc/api typecheck` | Pass |
| `pnpm --filter @littlearc/mobile typecheck` | Pass |
| `pnpm --filter @littlearc/ops-web typecheck` | Pass |
| `pnpm test:contract` | Pass; real contracts task now executes |
| `pnpm check:generated` | Pass; 1 registered generator |
| `git diff --check` | Pass |
| `pnpm check:workspace` | Pass; 23 tooling tests, boundaries, environment templates |
| `pnpm check:format` | Pass; Biome and Markdown |
| `pnpm typecheck` | Pass; tooling plus 6 package/application typecheck tasks |
| `pnpm build` | Pass; domain, contracts, API, worker, mobile export, and ops-web build |
| `pnpm test` | Pass; 23 tooling tests, 9 domain tests, 2 worker tests, 4 API tests, and 7 contract tests |
| `pnpm validate` | Pass |

## 5. Evidence Boundaries

Completed in this package:

- Domain kernel primitives and policies compile and are test-covered.
- OpenAPI 3.1 is generated from Zod schema source.
- Generated OpenAPI TypeScript paths and mobile/staff client factories compile.
- API shell serves the shared `/v1` contract metadata and OpenAPI document.
- Root `test:contract` runs real contract tests.
- Generated-output drift covers contract artifacts.
- A first committed `/v1` baseline detects removed paths, methods, and response
  codes.

Not claimed by this package:

- Runtime authentication, authorization, household membership, or session
  lifecycle.
- Database schemas, migrations, RLS, idempotency result storage, outbox, or
  change-event persistence.
- Real product CRUD routes, sync execution, conflict resolution, staff
  workflows, support actions, or production deployment.
- Mobile SQLCipher repositories, offline outbox behavior, or record screens.
- Any use of real child, participant, household, or medical document data.

## 6. Completion Decision

**Decision: COMPLETE.** The shared domain kernel, Zod/OpenAPI source,
generated clients, API `/v1` metadata routes, generated-output drift check, and
initial breaking-contract guard are implemented and validated in the local
synthetic M1 environment.

`FND-06` is the next ready package: Railway environment skeleton.

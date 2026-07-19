# FND-04 Contracts and Domain Kernel

> **Status:** Completed
> **Owner:** Engineering
> **Started date:** 19 July 2026
> **Last updated:** 19 July 2026
> **Work package:** `FND-04`
> **Depends on:** `FND-01`, `FND-02`, `FND-03`
> **Acceptance evidence:** [FND-04 implementation evidence](./fnd-04-implementation-evidence.md)
> **Inputs:** [Implementation roadmap](../roadmap.md),
> [architecture](../../core/littlearc-architecture-and-tech-stack.md),
> [product plan](../../core/littlearc-complete-product-plan.md), and
> [delivery dashboard](../../IMPLEMENTATION_STATUS.md)

---

## Status Summary

| Module | Status | Evidence |
| --- | --- | --- |
| Domain kernel primitives | Completed | See implementation evidence |
| Zod/OpenAPI contract source | Completed | See implementation evidence |
| Generated OpenAPI and clients | Completed | See implementation evidence |
| API contract integration | Completed | See implementation evidence |
| Client compile integration | Completed | See implementation evidence |
| Breaking-contract guard | Completed | See implementation evidence |
| Documentation and evidence | Completed | See implementation evidence |

## 1. Goal and Outcome

`FND-04` establishes the shared contract and domain foundation used by later
authentication, database, sync, record, consent, and staff packages. It does not
implement product workflows or persistence. The outcome is a versioned `/v1`
contract source, generated client types, and framework-independent domain
primitives that compile through the accepted root task graph.

The observable outcome is:

- `packages/domain` exports validated LittleArc identifiers, timestamps,
  revision, cursor, idempotency, role, capability, consent, audit, and record
  policy primitives without depending on frameworks, databases, native modules,
  or provider SDKs.
- `packages/contracts` exports Zod schemas, an OpenAPI 3.1 document, generated
  OpenAPI TypeScript types, and mobile/staff client factories.
- The API shell exposes `/v1` metadata and `/v1/openapi.json` from the shared
  contract package while retaining the FND-03 liveness/readiness behavior.
- Mobile and staff shells compile against generated client factories without
  importing backend implementation code.
- CI detects generated-contract drift and rejects breaking contract changes
  against the first committed `/v1` baseline.

## 2. Scope Boundaries

### Included

- Domain primitive constructors, parsers, branded TypeScript types, and policy
  helpers for the kernel entities required by the roadmap.
- Zod schemas for shared primitives, Problem Details, pagination, contract
  metadata, household/child/consent/audit/record identifiers, and sync mutation
  envelopes.
- OpenAPI 3.1 generation from the source schemas.
- Generated OpenAPI TypeScript output and compile-time mobile/staff client
  factories using the generated paths.
- Generated-output manifest registration for OpenAPI and client generation.
- Contract tests covering `/v1` conventions, Problem Details shape,
  client-generated types, and breaking-contract detection.
- Documentation updates and validation evidence.

### Excluded

- Better Auth route ownership, session lifecycle, household membership storage,
  and role assignment.
- Drizzle schemas, migrations, RLS, tenant context, idempotency result storage,
  outbox, and change-event persistence.
- Real CRUD routes for households, children, records, consent, audit, sync,
  files, staff operations, exports, deletion, reminders, tasks, or entitlements.
- Runtime API authorization, staff passkeys, support workflows, production
  data access, and any direct staff database dependency.
- Mobile repository hooks, SQLCipher schemas, offline outbox behavior, conflict
  screens, or domain persistence.
- Adoption of quarantined prototype mobile screens, components, theme, or
  design-token source.
- Real child, participant, household, or medical document data.

## 3. Dependencies and Decisions

`FND-01` supplies the workspace, exact dependency policy, generated-output
drift hook, and package boundaries. `FND-02` supplies CI entrypoints.
`FND-03` supplies application shells that can import shared packages.

Implementation decisions:

- Keep `domain` dependency-free or limited to non-framework utility packages
  only when strictly necessary.
- Keep `contracts` free of database, API runtime, Next.js, Expo, and React
  implementation dependencies.
- Use Zod as the schema source and generate OpenAPI 3.1 from those schemas.
- Treat generated files as committed artifacts and never edit them manually.
- Use the first generated OpenAPI document as the reviewed baseline for future
  breaking-change checks.
- Define identifiers and policies at the framework-independent domain level,
  while leaving persistence and authorization enforcement to later packages.

## 4. Data, Security, and Privacy

This package defines shapes and policies only. It must not introduce real data,
secrets, credentials, provider accounts, child records, participant data, or
medical documents.

Security and privacy controls for this package:

- Problem Details `detail` remains user-safe and log-safe by schema.
- Generated contracts must not expose encrypted payload fields as plaintext
  examples.
- IDs, revisions, cursors, and mutation identifiers are typed explicitly so
  later packages do not substitute ad hoc strings.
- Staff capability definitions default to no child-record visibility.
- Consent and AI-related schema fields separate consent grants from later
  processor execution.
- Contract tests fail when committed generated files drift from schema sources.

## 5. API and Client Conventions

The first `/v1` contract surface establishes conventions without pretending
future data routes exist:

- `GET /v1` returns contract metadata and the resource-group prefixes that are
  reserved by the accepted architecture.
- `GET /v1/openapi.json` returns the generated OpenAPI 3.1 document.
- Existing FND-03 `/live` and `/ready` endpoints remain operational health
  endpoints outside the versioned product API.
- Success responses return resource-specific shapes, not a universal
  `{ success, data }` envelope.
- Errors use `application/problem+json` with a stable `code` and `requestId`.
- Pagination uses `items` and opaque `nextCursor`.
- Mutable resources expose integer `revision`; mutations carry
  `baseRevision`, `mutationId`, and `Idempotency-Key` where applicable.

## 6. Verification

Focused checks:

- `pnpm --filter @littlearc/domain typecheck`
- `pnpm --filter @littlearc/domain test`
- `pnpm --filter @littlearc/contracts generate`
- `pnpm --filter @littlearc/contracts typecheck`
- `pnpm --filter @littlearc/contracts test:contract`
- `pnpm --filter @littlearc/api test`
- `pnpm --filter @littlearc/api typecheck`
- `pnpm --filter @littlearc/mobile typecheck`
- `pnpm --filter @littlearc/ops-web typecheck`
- `pnpm test:contract`
- `pnpm check:generated`

Broad checks:

- `pnpm check:workspace`
- `pnpm check:format`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm validate`
- `./tooling/validate-clean-checkout.sh`

## 7. Delivery Slices

1. Write and validate this package brief; mark `FND-04` in progress.
2. Implement framework-independent domain primitives and focused tests.
3. Implement Zod schema source and OpenAPI generation.
4. Generate OpenAPI TypeScript output and mobile/staff client factories.
5. Expose `/v1` metadata and `/v1/openapi.json` from the API shell.
6. Compile mobile and staff shells against the generated clients.
7. Register generated-output drift checks and breaking-contract tests.
8. Run focused validation, then root validation.
9. Record implementation evidence and update the delivery dashboard.

## 8. Definition of Done

`FND-04` is complete when:

- Domain primitives compile and have tests for valid and invalid inputs.
- The OpenAPI 3.1 document is generated from Zod schemas and committed.
- Mobile and staff client factories compile from generated OpenAPI types.
- The API shell serves the shared `/v1` metadata and OpenAPI document.
- Root `pnpm test:contract` runs real contract tests.
- Generated-output drift checks cover OpenAPI and client artifacts.
- Breaking-contract detection has a committed first `/v1` baseline.
- Evidence documents exact checks run and deferred gates.
- The delivery dashboard links the accepted plan and evidence.

## 9. Risks and Residual Obligations

| Risk | Control | Residual obligation |
| --- | --- | --- |
| Premature product-route claims | Expose only metadata/OpenAPI routes in the API shell | Real routes arrive with auth, database, and vertical slices |
| Domain policies drift from runtime authorization | Keep policies framework-independent and test-covered | `FND-05` and M2 enforce them through database and route checks |
| Generated output becomes stale | Register generation commands in the drift manifest | Future contract changes must regenerate artifacts intentionally |
| Breaking-change guard blocks legitimate evolution | Establish a reviewed baseline and document intentional updates | Later packages update baseline only after contract review |
| Sensitive examples leak into public contracts | Avoid real examples and payload snippets | Privacy canaries and observability guards arrive in `FND-07` |

# FND-09 ADR and Engineering Documentation Baseline

> **Status:** Completed
> **Started date:** 19 July 2026
> **Last updated:** 19 July 2026
> **Completion date:** 19 July 2026
> **Owner:** Engineering
> **Milestone:** M1
> **Work package:** `FND-09`
> **Depends on:** Accepted `FND-01` through `FND-08` implementation evidence
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
> **Acceptance evidence:** [FND-09 implementation evidence](./fnd-09-implementation-evidence.md)
> **Inputs:** [Implementation roadmap](../roadmap.md),
> [architecture](../../core/littlearc-architecture-and-tech-stack.md), and
> [M0 readiness evidence](../../core/m0-readiness-and-evidence.md)

---

## Outcome

`FND-09` makes the implemented M1 foundation reproducible as engineering
knowledge. Durable decisions receive accepted ADRs with alternatives,
consequences, review triggers, and supersession rules. Task-oriented engineering
notes explain the repository boundary, data-classification, environment,
migration, testing, and release-development contracts already enforced by the
repository.

## Scope

Included:

- Reconcile the architecture document's initial ADR list against what
  `FND-01` through `FND-08` actually implemented.
- Create accepted ADRs for implemented, durable choices: workspace boundaries;
  Expo mobile architecture and native-development workflow; REST/OpenAPI;
  Fastify/Drizzle modular-monolith boundaries; PostgreSQL, RLS, migrations, and
  `pg-boss`; Railway environment topology; privacy-safe observability; and the
  semantic design-system boundary.
- Record the final disposition of `spikes/native-compat`, its retained evidence,
  and the conditions under which its remaining source can be removed.
- Add concise repository-boundary, data-classification, environment, migration,
  testing, and release-development reference notes.
- Strengthen documentation validation so every ADR has the required decision
  metadata and sections.
- Update the ADR, reference, milestone, repository-context, and delivery-status
  indexes.
- Run documentation, formatting, root, and clean-checkout validation and record
  completion evidence.

Out of scope:

- ADRs for architecture that has not been implemented yet, including
  authentication, offline synchronization, envelope encryption, OCR/AI
  production behavior, billing, backup recovery, and post-pilot updates.
- Claiming Gate 1 mobile evidence before its separate validation pass, or
  claiming production, privacy/legal, restore, or real-data obligations have
  passed.
- Adding a deployment workflow, EAS, production Railway resources, new runtime
  dependencies, or application behavior.
- Deleting the native harness before its remaining physical-device evidence is
  either transferred or explicitly retired at the existing gate.
- Rewriting the roadmap merely to report work-package status.

## Decision Inventory

| Decision area | Disposition | Rationale |
| --- | --- | --- |
| Workspace and repository boundaries | ADR | Implemented and mechanically enforced across all application/package nodes. |
| Expo, New Architecture, Unistyles, development clients, and local native builds | ADR | One coupled mobile platform and development-workflow decision; includes spike disposition. |
| REST/OpenAPI contracts | ADR | Implemented source/generation boundary with meaningful alternative protocols. |
| Fastify/Drizzle modular monolith | ADR | Implemented server structure and dependency direction. |
| PostgreSQL, RLS, explicit migrations, and `pg-boss` | ADR | Coupled persistence/transaction/queue decision with operational consequences. |
| Railway Singapore and environment isolation | ADR | Staging is implemented; production remains explicitly deferred. |
| Privacy-safe observability wrappers | ADR | Implemented data-handling boundary around logs, analytics, flags, and error reporting. |
| Semantic design-system boundary | ADR | Implemented cross-platform token/theme/component constraint. |
| Future architecture items from the core list | Deferred | Create their ADRs when implementation begins and evidence exists. |

## Module Status

| Module | Status | Notes |
| --- | --- | --- |
| Package brief and decision inventory | Completed | Scope is reconciled against the roadmap and accepted FND evidence. |
| ADR schema and validation | Completed | Review/supersession metadata and required sections are enforced. |
| Initial accepted ADR set | Completed | Eight implemented foundation decisions with alternatives and review triggers. |
| Engineering reference notes | Completed | Six task-oriented notes plus reference navigation. |
| Context and status navigation | Completed | Indexes, context map, guides, and dashboard are reconciled. |
| Validation and evidence | Completed | Focused, broad, and clean-checkout proof passed. |

## Implementation Plan

1. Extend the ADR template and documentation validator with `Review date`,
   `Review triggers`, and `Supersedes` metadata plus required Context, Decision,
   Alternatives Considered, Consequences, and Validation sections.
2. Create sequential ADRs for the eight implemented foundation decision areas.
   Each ADR must cite current configuration/evidence, identify meaningful
   alternatives, state tradeoffs, distinguish accepted scope from deferred
   scope, and define a review date or earlier trigger.
3. Record the native compatibility harness as retained evidence rather than a
   production workspace package. Keep the narrow ML Kit override while it has a
   real mobile consumer and preserve only the evidence needed for unresolved
   physical-device gates.
4. Add an engineering-reference index and six focused notes for repository
   boundaries, data classification, environments, migrations, testing, and the
   development-to-release path. Notes must point to executable commands and
   owning source rather than duplicate configuration exhaustively.
5. Update `docs/adr/README.md`, `docs/reference/README.md`, `docs/index.md`,
   `docs/context-map.yaml`, the M1 plan index, and relevant contributor guides so
   the baseline is discoverable from task keywords.
6. Run focused documentation checks and inspect the complete diff. Resolve
   broken links, metadata drift, inaccuracies, and contradictions before marking
   the package complete.
7. Run root validation and clean-checkout proof, write the evidence record, then
   update the plan and dashboard to `COMPLETE` only if all required checks pass.

## Acceptance Criteria

- The ADR index lists every implemented foundation ADR with status, decision
  summary, accepted date, and next review date.
- Every accepted ADR records context, the chosen option, meaningful alternatives,
  consequences, validation evidence, review triggers/date, and supersession
  metadata.
- Future choices are not presented as implemented merely because the core
  architecture document lists them.
- The harness-retirement ADR resolves the stale deletion trigger without
  converting deferred physical-device evidence into a pass.
- Repository-boundary, data-classification, environment, migration, testing,
  and release-development notes identify authoritative source/configuration,
  safe commands, prohibited shortcuts, and relevant follow-up gates.
- Context lookup can find the ADR and engineering baseline using relevant task
  terms.
- The dashboard, implementation plan, milestone index, ADR index, reference
  index, and evidence record agree on FND-09 state.
- Documentation checks, formatting checks, root validation, `git diff --check`,
  and clean-checkout validation pass before completion is claimed.

## Validation

Focused checks:

- `./scripts/context/validate-docs.sh`
- `./scripts/context/find-context.sh "ADR repository boundary"`
- `./scripts/context/find-context.sh "data classification migration testing release"`
- `pnpm check:docs`
- `pnpm check:format`

Broad checks:

- `pnpm check:workspace`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm validate`
- `git diff --check`
- `./tooling/validate-clean-checkout.sh`

## Evidence

[FND-09 implementation evidence](./fnd-09-implementation-evidence.md) records
the accepted focused, broad, and source-only clean-checkout results.

## Risks And Controls

| Risk | Control | Residual obligation |
| --- | --- | --- |
| ADRs restate aspiration as shipped architecture | Scope each decision to executable FND-01–08 evidence and label future scope deferred. | Add later ADRs when the owning work package implements those choices. |
| Reference notes drift from scripts | Link owning files and commands; keep detailed values in executable configuration and catalogs. | Update the note when its workflow or governing source changes. |
| Too many narrow ADRs obscure coupled choices | Group choices that share one decision boundary and review trigger. | Split only when a later change can vary independently. |
| Harness deletion loses unresolved evidence | Retain the minimal source/evidence until the physical-device gate owns or replaces it. | Revisit after required device evidence and upstream OCR compatibility review. |
| Documentation validation checks headings but not truth | Pair structural checks with manual reconciliation against current source and evidence. | Review ADRs on the recorded dates and earlier triggers. |

## Decisions

- Use eight ADRs for implemented foundation boundaries; defer the remaining
  architecture-document candidates until their implementation begins.
- Keep operational guidance under `docs/reference/engineering/` and keep
  architecture rationale under `docs/adr/`.
- Treat review dates as scheduled checkpoints, not automatic expiration. Any
  named trigger requires earlier review.
- Preserve the retained native harness during FND-09 because physical-device
  obligations remain unresolved even though configuration transfer and release
  exports now pass in the production mobile application.

## Follow-Up

- The later [Gate 1 mobile validation pass](./gate-1-mobile-device-and-accessibility-evidence.md)
  accepts an iOS simulator plus physical Android for foundation build/runtime
  and reference-state evidence; broader physical checks remain pre-pilot.
- Create ADRs for offline data, sync, encryption, AI/OCR, backup, billing, and
  update strategy only when their owning packages begin.
- Revisit every accepted FND-09 ADR by its recorded review date or earlier when
  a named trigger occurs.

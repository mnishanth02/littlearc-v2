# FND-09 Implementation Evidence

> **Status:** Accepted
> **Last updated:** 20 July 2026
> **Owner:** Engineering
> **Work package:** `FND-09`
> **Plan:** [FND-09 ADR and Engineering Documentation Baseline](./fnd-09-adr-and-engineering-documentation-baseline-plan.md)

---

## 1. Accepted Outcome

The implemented FND-01 through FND-08 foundation now has an indexed ADR
baseline and task-oriented engineering references. The records distinguish
shipped decisions from future architecture, include alternatives and review
triggers, resolve the native-spike disposition, and are reachable through the
repository context workflow.

## 2. ADR Baseline

Eight accepted ADRs cover the implemented decision boundaries:

1. Workspace and repository boundaries.
2. Expo native development, local builds, and retained-spike disposition.
3. REST/OpenAPI contract boundary.
4. Fastify/Drizzle modular monolith.
5. PostgreSQL, RLS, migrations, and `pg-boss`.
6. Railway Singapore staging topology with production deferred.
7. Privacy-safe observability wrapper boundary.
8. Platform-neutral semantic design-system boundary.

Every ADR records date, owner, scheduled review, supersession metadata, context,
decision, alternatives, consequences, validation, and earlier review triggers.
Documentation validation now rejects ADRs missing those structural requirements
and requires a successor link when an ADR is marked `Superseded`.

Architecture candidates for offline synchronization, encryption, production
OCR/AI, backups, billing, updates, and other later work remain deferred until
their owning implementation package begins.

## 3. Engineering References

The new `docs/reference/engineering/` index links focused notes for:

- repository package/import boundaries;
- public, sensitive, secret, and restricted-product-data handling;
- local, staging, and deferred production environments;
- reviewed forward PostgreSQL migrations;
- static, unit, contract, build, native, and reproducibility test layers; and
- local development, deterministic CI, staging release, and future release
  authorization boundaries.

The notes point to executable configuration, commands, and owning ADRs instead
of duplicating detailed configuration values.

## 4. Native Harness Decision

ADR-0002 records the real mobile application as authoritative for Expo/native
configuration and the root workspace as authoritative for the ML Kit override.
`spikes/native-compat` remains outside the production workspace and is retained
only for unresolved physical-device evidence. Its source may be removed after
that evidence is transferred or closed and the OCR override is reviewed.

The 20 July 2026 founder replan accepts an iOS simulator and physical Android
device for Gate 1 only. The resulting build/runtime and accessible-reference-
state evidence is recorded in the
[Gate 1 mobile dossier](./gate-1-mobile-device-and-accessibility-evidence.md).
Physical iOS and the broader device-capability matrix remain pre-pilot
obligations.

## 5. Validation Results

All commands used Node.js 24.18.0 and pnpm 11.14.0.

| Validation | Result |
| --- | --- |
| `./scripts/context/validate-docs.sh` | Passed; all metadata, ADR structure, mapped paths, and local links valid. |
| Context lookup for ADR/repository-boundary terms | Passed; selected `engineering-docs` and `foundation`. |
| Context lookup for classification/migration/testing/release terms | Passed; selected the engineering baseline and relevant database/API context. |
| `pnpm check:workspace` | Passed; 32 tooling tests and 13 workspace-node boundary checks passed. |
| `pnpm check:format` | Passed; Biome checked 148 files and Markdownlint reported zero issues across 69 maintained Markdown files. |
| `pnpm typecheck` | Passed across root tooling and 13 package nodes. |
| `pnpm test` | Passed; 95 total tooling, unit, and contract tests. |
| `pnpm build` | Passed; package/server/staff builds and Android/iOS Hermes exports completed. |
| `pnpm validate` | Passed, including toolchain, workspace, supply-chain, generated-output, formatting, documentation, and type checks. |
| `git diff --check` | Passed. |
| `./tooling/validate-clean-checkout.sh` | Passed from a 273-file source-only snapshot with a frozen install and uncached 13-package typecheck graph. |

During the frozen clean-checkout install, Sharp printed its known source-build
fallback message about `node-addon-api`; pnpm completed successfully and the
full validation exited successfully. It is not recorded as a failed check.

## 6. Completion Decision

**Decision: COMPLETE.** FND-09 meets the roadmap scope: implemented foundation
choices, meaningful alternatives, review dates/triggers, spike disposition, and
the six engineering-note areas are recorded, indexed, structurally enforced,
and reproducible from a clean checkout.

M1 work packages are accepted, but Gate 1 is not declared passed. The accepted
mobile development-client and accessibility/reference-state criteria now pass;
the seeded cross-household RLS rejection criterion remains open. Physical iOS
and the other broader device checks remain explicit pre-pilot obligations.

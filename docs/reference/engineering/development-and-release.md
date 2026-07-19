# Development and Release

> **Status:** Active
> **Last updated:** 2026-07-19
> **Owner:** Engineering
> **Applies to:** Local changes, CI, staging releases, and future production work

## Development Path

1. Select exact Node 24.18.0 and pnpm 11.14.0.
2. Install with `pnpm install --frozen-lockfile`.
3. Open the delivery dashboard, nearest `AGENTS.md`, and focused package plan.
4. Change source and tests within declared package boundaries.
5. Run focused checks, then `pnpm validate`; run builds and clean-checkout proof
   when required by the work package.
6. Update plans, evidence, ADRs, and the delivery dashboard only for actual state
   changes.

## CI And Artifact Identity

Pull-request CI runs deterministic validation and supply-chain checks with
immutable actions. Build metadata ties artifacts to the exact source commit and
lockfile digest. CI does not deploy or target privileged environments; a passing
workflow proves the tested source, not release approval.

## Staging Release

Follow the [Railway staging runbook](../railway-staging-release.md): validate the
source, apply the reviewed migration explicitly, deploy API then worker then
staff, verify health/readiness and safe logs, and record source/migration/result
evidence. Use Railway deployment history for application rollback; database
rollback requires a reviewed compatibility or restore procedure.

## Mobile Development And Pilot Distribution

Use Expo custom development clients and direct local `expo run:ios` /
`expo run:android` builds under [ADR-0002](../../adr/0002-expo-native-development-and-spike-disposition.md).
Release exports and simulator runs are build evidence, not signed-device,
installation, upgrade, accessibility, or store-distribution acceptance.

## Not Yet Authorized

There is no production deployment workflow, EAS/update strategy, real-data
release, automated database rollback, or public-store release baseline. Each
requires its named later gate, ownership, recovery evidence, and ADR before use.

# Development and Release

> **Status:** Active
> **Last updated:** 2026-07-25
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

### Free Personal Team iPhone Build

VLT-03 adds an opt-in main-target-only profile for direct testing on the
owner's iPhone without Apple Developer Program enrollment. Registered mode
remains the default and retains the production bundle ID, Share Extension, and
App Group. Personal Team mode uses `com.nishanth.littlearc.dev` and disables
only incoming shares from other iOS apps:

```sh
cd apps/mobile
pnpm run native:prebuild:ios:personal
pnpm run ios:personal
```

Sign into **Xcode → Settings → Accounts** first, connect and trust the iPhone,
and enable Developer Mode. If automatic signing needs help, open
`apps/mobile/ios/LittleArc.xcworkspace`, select the LittleArc target, and choose
the account's **Personal Team** under **Signing & Capabilities**.

The clean prebuild deletes and regenerates only the ignored native iOS project;
do not keep manual native changes there. Personal Team App IDs, devices, and
provisioning profiles expire after seven days, so rebuild and reinstall after
expiry. This path is local-only: it does not provide TestFlight, App Store,
EAS internal distribution, or production signing evidence.

Apple's current capability matrix includes App Groups for free registered
developers. After the main-target-only build passes, the separate
`native:prebuild:ios:personal-share` and `ios:personal:share` scripts may be
used as an explicitly experimental iOS incoming-share check. Restore the
registered native profile with:

```sh
pnpm run native:prebuild:ios:registered
```

## Not Yet Authorized

There is no production deployment workflow, EAS/update strategy, real-data
release, automated database rollback, or public-store release baseline. Each
requires its named later gate, ownership, recovery evidence, and ADR before use.

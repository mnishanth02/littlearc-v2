# FND-02 Implementation Evidence

> **Work package:** `FND-02`
> **Status:** Hosted acceptance in progress
> **Evidence date:** 18 July 2026
> **Toolchain:** Node.js 24.18.0, pnpm 11.14.0
> **Plan:** [FND-02 package plan](./fnd-02-ci-and-supply-chain-plan.md)

## 1. Implemented baseline

### Deterministic CI

`.github/workflows/ci.yml` now runs on pull requests, `main` pushes, and manual
dispatch. Its `quality` job:

- Checks out without persisted GitHub credentials
- Installs the exact pnpm and Node versions
- Restores only the pnpm store cache keyed through `pnpm-lock.yaml`
- Performs a frozen install
- Runs validation, unit tests, contract tests, and the workspace build
- Fails if installation or build changes the lockfile
- Uploads a 14-day source-traceability metadata artifact

The root task graph now exposes stable `test:unit` and `test:contract` entry
points. The current application packages are placeholders, so their Turborepo
test, contract, typecheck, and build task counts are zero until `FND-03` and
`FND-04` add real package scripts. This is recorded as current scope, not
reported as application-test coverage.

### Supply-chain controls

`.github/workflows/supply-chain.yml` provides:

- High-or-critical vulnerability and denied-license review for pull-request
  dependency changes
- TruffleHog scanning over the changed commit range on pull requests and pushes,
  with a weekly full-history run
- A weekly/manual production dependency audit
- Read-only workflow permissions, full action SHA pins, explicit timeouts, and
  concurrency cancellation

`renovate.json` groups weekly dependency updates, pins dependency ranges and
GitHub Action digests, keeps native-runtime changes isolated, and excludes the
retained M0 harness.

### Enforced local policy

The root `check:supply-chain` gate parses all workflow YAML and rejects:

- Mutable third-party action references
- `pull_request_target`
- Missing job timeouts
- Permissions beyond `contents: read`
- Persisted checkout credentials
- General-purpose caches
- setup-node caches not scoped to pnpm and the root lockfile
- Any deployment environment or recognized deployment action

The generated-output manifest is valid and currently contains zero generators.
`FND-04` owns registration of the first contract/client generator; once
registered, the gate runs it and fails on output drift.

### Traceability

The CI metadata writer records only the tested commit, optional pull-request
head commit, repository/ref, workflow/run identity, exact Node and pnpm
versions, timestamp, and the SHA-256 digest of `pnpm-lock.yaml`. A regression
test proves unrelated environment values are not copied into the artifact.
Artifact attestation is intentionally deferred to the release package that
first produces a distributable mobile or service artifact.

## 2. Local validation results

All checks below ran from the repository root on 18 July 2026 with the exact
accepted toolchain.

| Validation | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass; lockfile SHA-256 remained `b91381a802bd6b5f172a5b98e221dcce31b19cf865f81f0b6812d000f19ce8f1` |
| `pnpm validate` | Pass |
| Tooling tests | 23 passed across 4 files |
| Workflow policy | Pass; 2 workflows parsed and accepted |
| Workspace boundaries | Pass; 13 package nodes |
| Environment templates | Pass; 4 applications |
| Generated-output drift | Pass; 0 registered generators |
| `pnpm test` | Pass; 23 tooling tests, 0 current application/contract tasks |
| `pnpm build` | Pass; 0 current application build tasks |
| `pnpm audit --prod --audit-level high` | Pass; no known vulnerabilities |
| CI metadata generation | Pass; exact tool versions and lockfile digest recorded |
| `tooling/validate-clean-checkout.sh` | Pass; 94-file source-only snapshot, frozen install, validation, and 23 tests |
| `git diff --check` | Pass |

No prototype source under `apps/mobile/src/app`, `apps/mobile/src/components`,
`apps/mobile/src/theme`, `packages/design-tokens/src`, or
`spikes/native-compat` was changed.

## 3. Hosted validation and repository controls

The public repository is
[`mnishanth02/littlearc-v2`](https://github.com/mnishanth02/littlearc-v2).
The local `development` branch tracks `origin/development`, and `main` is
the default branch.

The following no-cost controls were enabled and verified on 18 July 2026:

- Dependabot vulnerability alerts and automatic security updates
- GitHub secret scanning and push protection; the alert inventory was empty
- Repository-wide full-SHA pin enforcement for GitHub Actions
- Read-only default workflow token permissions without pull-request approval
  capability
- Active `Protect main` ruleset, ID `19144543`
- Required pull requests for `main`
- Required `quality`, `dependency review`, and `secret scan` checks
- Strict up-to-date branch enforcement, blocked force pushes, blocked branch
  deletion, and required review-thread resolution

The initial hosted
[`CI` run](https://github.com/mnishanth02/littlearc-v2/actions/runs/29639376503)
passed on commit `5468e89e151077dbaf265cf9bef529e3c924b1d9`. Its downloaded
metadata artifact matched that source commit and the local lockfile digest
`b91381a802bd6b5f172a5b98e221dcce31b19cf865f81f0b6812d000f19ce8f1`.

The manually dispatched
[`Supply Chain` run](https://github.com/mnishanth02/littlearc-v2/actions/runs/29648207005)
passed both the current dependency audit and full-history secret scan.

Hosted acceptance remains open only until the current `development` to
`main` pull request proves all three required pull-request checks. Renovate
installation is a no-cost manual follow-up because GitHub App authorization
requires an interactive signed-in browser; it is useful maintenance automation,
not a blocker for the deterministic CI and supply-chain control baseline.

GitHub secret validity checks and non-provider pattern scanning remain disabled
because GitHub did not make those optional capabilities available through the
current free repository configuration. TruffleHog and GitHub provider-pattern
scanning remain active, so this limitation is recorded as reference rather than
a blocker.

## 4. Deferred ownership

| Obligation | Owner package | Trigger |
| --- | --- | --- |
| Real mobile/API/worker/web build and test tasks | `FND-03` | Application skeletons are added |
| Contract generation and first drift-manifest entry | `FND-04` | OpenAPI/client generation exists |
| Production environment and reviewed-branch deployment controls | `FND-06` and release work | Organization-owned Railway access and release workflow exist |
| Signed artifact attestations and binary provenance | Release hardening | A distributable artifact is produced |

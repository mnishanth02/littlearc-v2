# FND-02 Continuous Integration and Supply-Chain Baseline

> **Status:** Completed
> **Owner:** Engineering
> **Started date:** 18 July 2026
> **Last updated:** 19 July 2026
> **Completion date:** 18 July 2026
> **Work package:** `FND-02`
> **Depends on:** `FND-01`
> **Acceptance evidence:** [FND-02 evidence](./fnd-02-implementation-evidence.md)

## Status Summary

| Module | Status | Evidence |
| --- | --- | --- |
| Deterministic GitHub Actions validation | Completed | See implementation evidence |
| Supply-chain and dependency controls | Completed | See implementation evidence |
| Secret scanning and workflow policy | Completed | See implementation evidence |
| Build metadata and source traceability | Completed | See implementation evidence |
| Hosted PR validation | Completed | See implementation evidence |

## 1. Problem and outcome

LittleArc has deterministic root commands, but no independent system currently
proves that every proposed change installs from the committed lockfile, passes
quality gates, avoids newly introduced vulnerable dependencies or credentials,
and maps produced evidence to one source commit.

The outcome is a least-privilege GitHub Actions baseline that runs the same
commands used locally and blocks unsafe change classes before merge. It covers:

- Frozen dependency installation and lockfile immutability
- Formatting/linting, typechecking, unit tests, contract tests, and builds
- Pull-request dependency review and change-range secret scanning
- Generated-output drift and repository workflow-policy checks
- Safe pnpm-store caching only
- Source commit, lockfile, workflow, and run metadata for CI artifacts
- An explicit prohibition on production deployment jobs at this stage

This package does not create a production deployment, sign a mobile binary, or
claim release provenance for artifacts that do not yet exist. Artifact
attestations belong in the later release workflow that produces a distributable
binary. It also does not create generated clients; `FND-04` must register the
first generator in the drift manifest.

## 2. Dependencies and decisions

`FND-01` is complete and supplies exact Node/pnpm pins, the committed lockfile,
root validation commands, and the Turborepo task graph. Starting `FND-02` before
`FND-03` is a deliberate sequence change requested by the delivery owner. This
is safe because application packages will automatically join the same root task
graph when their scripts are added.

Decisions for this package:

- GitHub Actions is the CI provider defined by the accepted architecture.
- Every third-party action is pinned to a full commit SHA, with the reviewed
  release recorded in a comment.
- Workflow permissions default to `contents: read`; no workflow receives write
  permission or repository secrets.
- `pull_request_target` is prohibited because it can combine privileged base
  context with untrusted pull-request changes.
- Only the pnpm content-addressed store is cached. `node_modules`, build output,
  coverage, generated clients, and Turborepo state are not restored from shared
  caches.
- Production environments and deployment actions are forbidden by the local
  workflow policy until a later, reviewed release package introduces them.
- Renovate configuration is committed now; installing/authorizing the Renovate
  app remains a repository-administrator action.

## 3. Data and trust review

CI handles source code, synthetic fixtures, dependency metadata, and build
metadata. It must never receive household, child, participant, document, or
production environment data. The provenance record contains repository/run
identifiers, commit/ref, lockfile SHA-256, and tool versions only.

Trust boundaries are the pull-request author, GitHub runner, third-party
actions, npm registry, GitHub dependency graph, and uploaded CI artifacts. The
controls are immutable action pins, frozen installs, minimal token permissions,
disabled persisted Git credentials, no secrets in PR jobs, timeouts, concurrency
cancellation, workflow policy tests, and secret/dependency scanning.

Dependency review availability depends on repository visibility and the GitHub
security plan. Unsupported repository settings are a visible hosted-acceptance
failure, not a reason to silently skip the check.

## 4. Contract and failure design

The CI contract has three stable required job names:

- `CI / quality`
- `Supply Chain / dependency review`
- `Supply Chain / secret scan`

Any command failure returns a non-zero exit and blocks its job. Frozen-install
or lockfile-diff failure means dependency declarations are not reproducible.
Dependency review fails for newly introduced high-or-critical vulnerabilities.
Secret scanning fails for detected verified or unknown credentials. Generated
drift fails when a registered generator changes committed output.

Scheduled dependency audit is defense in depth for the current dependency
graph; it is intentionally not the deterministic pull-request gate because
registry advisories can change without a source change.

Rollback is removal or reversion of these workflow/configuration files. There
is no runtime feature flag and no application migration.

## 5. User experience and accessibility

There is no end-user interface. Developer-facing failures must name the broken
policy and remediation. Workflow/job names remain stable so branch rules and
pull-request status are understandable. Logs must not dump the environment or
credentials.

## 6. Verification

Local verification includes:

1. Unit tests for workflow-policy rejection and provenance metadata.
2. Parsing every workflow and enforcing SHA pins, least privilege, job timeouts,
   safe checkout, cache rules, and deployment prohibition.
3. Validating generated-output and Renovate manifests.
4. Frozen install, root validation, unit/contract tasks, and build.
5. Lockfile cleanliness and a temporary clean-checkout proof.
6. Policy regression tests that prove mutable actions, excessive permissions,
   unsafe caches, and deployment environments are rejected.

Hosted acceptance additionally requires all three stable jobs to run against a
real pull request, repository rules to require them on `main`, dependency-review
entitlement to be confirmed, GitHub secret scanning/push protection to be
enabled where the plan permits, and uploaded build metadata to match the run's
source SHA.

Evidence belongs in `docs/impl-plan/m1-foundation/fnd-02-implementation-evidence.md`. Engineering owns
local acceptance; a repository administrator owns hosted settings evidence.

## 7. Delivery slices

1. Commit the package plan and mark the work package in progress.
2. Add deterministic CI and stable unit/contract task entry points.
3. Add dependency review, secret scanning, scheduled audit, and Renovate.
4. Add workflow, generated-output, and supply-chain configuration policies.
5. Add build metadata generation and validation.
6. Run local and clean-checkout validation and record evidence.
7. Push through a pull request, enable repository controls, and close hosted
   acceptance.

## 8. Definition of done

`FND-02` is complete only when:

- All local checks and tests pass from the exact pinned toolchain.
- The committed lockfile remains unchanged after frozen installation.
- All third-party actions are full-SHA pinned and policy validation passes.
- Secret and dependency review jobs pass on a real pull request.
- Required status checks and reviewed-branch rules protect `main`.
- Production deploys remain impossible from these workflows.
- CI metadata demonstrates source-commit and lockfile traceability.
- Deferred release attestation and first-generator registration have named
  owning work packages.

## 9. Risks and residual obligations

| Risk | Control | Residual obligation |
| --- | --- | --- |
| Compromised mutable action tag | Full commit SHA pins | Renovate reviews future SHA updates |
| Malicious pull-request code | Read-only token, no secrets, isolated hosted runner | Review any future self-hosted runner use |
| Dependency-review availability changes | Public-repository PR proof | Recheck the control before any visibility change |
| Secret-scanner image tag moves | Pin action SHA and scanner version | Replace with digest-pinned execution when the action supports it |
| False secret positives | Report verified and unknown results; review findings | Never suppress a real credential with a broad exclusion |
| Stale generated output | Manifest-driven regeneration and diff | `FND-04` registers generated clients |
| Misleading provenance claim | Metadata only; no attestation claim | Release package adds signed artifact attestations |

## 10. Research basis

Primary sources consulted on 18 July 2026:

- [GitHub secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
  for full-SHA action pinning and least-privilege permissions.
- [GitHub dependency review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review)
  for pull-request behavior and repository-plan availability.
- [GitHub dependency caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)
  for cache scope and branch isolation.
- [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
  for release-artifact provenance boundaries.
- [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
  for required checks and branch governance.
- [GitHub deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
  for branch restrictions and protection rules.
- [TruffleHog repository documentation](https://github.com/trufflesecurity/trufflehog)
  for pull-request range scanning and failure behavior.

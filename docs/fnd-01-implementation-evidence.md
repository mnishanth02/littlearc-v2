# FND-01 Monorepo and Toolchain Implementation Evidence

> **Status:** Complete
> **Completed:** 18 July 2026
> **Work package:** `FND-01`
> **Owner:** Engineering
> **Package brief:** [FND-01 implementation plan](./fnd-01-monorepo-and-toolchain-plan.md)

---

## 1. Outcome

FND-01 established the reproducible root repository foundation without creating
application runtimes or adopting quarantined prototype source.

The completed foundation contains:

- one root pnpm workspace and committed lockfile;
- 4 private application nodes and 9 private shared-package nodes;
- an exact Node, pnpm, Turborepo, TypeScript, Biome, Vitest, and Markdown toolchain;
- strict shared and runtime-specific TypeScript configurations;
- a truthful Turborepo task graph with no placeholder application tasks;
- a root Biome 2 configuration with explicit inputs and named prototype exclusions;
- supported Markdown checks with documented legacy product-plan exclusion;
- a stable repository-owned package-boundary policy;
- 18 positive and fail-closed boundary/environment tests;
- per-application environment examples and a classified variable catalog; and
- a temporary source-only clean-checkout validation command.

No product, participant, or child data was used.

## 2. Accepted Versions

| Technology | Verified version |
| --- | ---: |
| Node.js | 24.18.0 |
| pnpm | 11.14.0 |
| Turborepo | 2.10.5 |
| TypeScript | 6.0.3 |
| Biome | 2.5.4 |
| Vitest | 4.1.10 |
| `markdownlint-cli2` | 0.23.1 |
| `@types/node` | 24.13.3 |

The user's global Node default was not changed. Validation selected the existing
Node 24.18.0 NVM installation explicitly.

## 3. Workspace Evidence

`pnpm exec turbo ls` reported exactly 13 workspace packages:

- `@littlearc/api`
- `@littlearc/auth`
- `@littlearc/config`
- `@littlearc/contracts`
- `@littlearc/crypto`
- `@littlearc/database`
- `@littlearc/design-tokens`
- `@littlearc/domain`
- `@littlearc/mobile`
- `@littlearc/observability`
- `@littlearc/ops-web`
- `@littlearc/test-kit`
- `@littlearc/worker`

The pnpm install scope also counts the private root, so it correctly reports 14
workspace projects. `spikes/native-compat` does not appear in either the root
workspace dependency graph or root lockfile.

## 4. Validation Evidence

| Check | Observed result |
| --- | --- |
| Root install | Frozen install passed; root lockfile remained unchanged |
| Lockfile hash after frozen install | `37ce6f8d71247019f1336f2af250312266f18a04a81bce3527527b09a2cf515f` |
| Toolchain check | Exact Node 24.18.0 and pnpm 11.14.0 accepted |
| Wrong runtime check | Active Node 26.4.0 rejected with `toolchain_mismatch` |
| Boundary/environment tests | 2 files and 18 tests passed |
| Workspace policy | 13 package nodes verified |
| Environment policy | 4 application templates verified |
| Biome | 25 supported files passed; no fixes required |
| Markdown | 11 maintained Markdown files passed with zero issues |
| Tooling TypeScript | `tsc --project tooling/tsconfig.json` passed |
| Root validation | `pnpm validate` passed repeatedly |
| Clean-checkout proof | Frozen install and validation passed from an 80-file temporary source snapshot |
| Root `test` / `build` graph | Commands exited successfully and truthfully reported zero application/package tasks |
| Diff hygiene | `git diff --check` passed |

The zero application/package tasks are intentional. FND-01 registers structural
workspace nodes; `FND-03` adds real application typecheck, test, build, and
development scripts. Root tooling already has a real TypeScript check and test
suite, so the foundation itself is not validated through placeholder commands.

## 5. Negative Scenarios Proven

The automated policy suite rejects:

- a framework dependency in `@littlearc/domain`;
- contracts depending on database models;
- operations web depending directly on the database package;
- application-to-application dependencies;
- package-to-application dependencies;
- ranged external versions;
- non-`workspace:*` internal versions;
- undeclared `@littlearc/*` source imports;
- publishable workspace packages;
- root inclusion of the retained native spike;
- relative imports escaping a workspace;
- populated secret or sensitive example values;
- undocumented environment variables; and
- client-visible Expo variables not classified as public.

The exact toolchain checker separately rejects a non-matching Node runtime.

## 6. Preservation Evidence

`git diff --exit-code` passed for:

- `apps/mobile/src/**`;
- `packages/design-tokens/src/**`; and
- `spikes/native-compat/**`.

The design-token manifest joined the root graph, but its source and provisional
public API remain unchanged for `FND-08`.

The retained M0 harness also passed, independently:

```text
pnpm install --frozen-lockfile  PASS
pnpm typecheck                  PASS
```

Its local lockfile and narrow ML Kit core override remain authoritative until
`FND-03` transfers the accepted native graph.

## 7. Documented Exceptions and Follow-Up

- The accepted long-form product plan is excluded from the new Markdown lint
  baseline because its reference/table conventions predate FND-01. Other
  maintained engineering and repository Markdown is checked.
- Existing mobile and design-token source is explicitly excluded from Biome
  until `FND-08` performs adopt/adapt/reference/discard review.
- Application tasks are absent until `FND-03`; no fake scripts were introduced.
- CI, secret scanning, dependency review, and generated-client drift checks
  remain `FND-02` scope.

These are named scope boundaries, not unreported passes.

## 8. Completion Decision

**Decision: COMPLETE.** The root workspace, exact versions, shared
configuration, package boundaries, environment templates, documentation, and
one-command clean-checkout proof meet the FND-01 definition of done.

`FND-03` is the next ready work package. `FND-02` remains next after the
application skeleton supplies its real tasks and outputs.

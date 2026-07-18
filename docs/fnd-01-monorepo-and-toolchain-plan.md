# FND-01 Monorepo and Toolchain Implementation Plan

> **Status:** Implemented and accepted
> **Version:** 1.0
> **Prepared:** 18 July 2026
> **Work package:** `FND-01`
> **Owner:** Engineering
> **Delivery status:** `COMPLETE`; see [implementation evidence](./fnd-01-implementation-evidence.md)
> **Inputs:** [Architecture and tech stack](./littlearc-architecture-and-tech-stack.md),
> [implementation roadmap](./littlearc-implementation-plan-and-roadmap.md),
> [M0 evidence](./m0-readiness-and-evidence.md), and
> [delivery register](./implementation-status.md)

---

## 1. Decision Summary

Implement `FND-01` as a structural foundation, not as an application-scaffolding
package.

The package will:

- create one root pnpm 11.14.0 workspace and one committed root lockfile;
- register the four planned applications and nine shared packages as workspace
  members without bootstrapping their frameworks;
- pin the accepted Node, Turborepo, TypeScript, Biome, Vitest, and Markdown
  toolchain exactly;
- establish shared TypeScript, formatting, Markdown, package-boundary, ignore,
  and editor conventions;
- add per-application environment templates containing variable names,
  classification, and descriptions but no credentials;
- provide one clean-checkout validation entry point; and
- retain the M0 native harness and all loose design prototypes unchanged.

`FND-01` must not create a misleading collection of empty applications that
claim to build or test. A root task succeeds only when a real participating
workspace script succeeds. Framework-specific scripts arrive with `FND-03`.

No product or child data is read or created by this package. Synthetic fixtures
remain the only permitted data after this package.

---

## 2. Problem and Observable Outcome

### 2.1 Problem

The repository currently contains useful prototypes, the M0 native-compatibility
harness, documentation, and a provisional design-token package. It does not
have a root package manager, root lockfile, task graph, shared compiler/linter
configuration, registered application packages, or a reproducible root
validation command.

Starting feature or application work in this state would allow:

- incompatible tool versions between packages;
- imports that cross architectural boundaries;
- accidental adoption of prototype APIs before `FND-08` review;
- application-local lockfiles and divergent dependency graphs;
- unreviewed secrets or public configuration in repository files; and
- checks that work only in the original developer's environment.

### 2.2 Observable outcome

From a source-only checkout on a supported machine, one command verifies the
Node and pnpm versions, performs a frozen install, validates workspace and
dependency boundaries, checks supported source/document formatting, and runs
all currently implemented package typechecks.

After completion, `pnpm turbo ls` reports exactly:

- `@littlearc/mobile`
- `@littlearc/api`
- `@littlearc/worker`
- `@littlearc/ops-web`
- `@littlearc/contracts`
- `@littlearc/domain`
- `@littlearc/database`
- `@littlearc/crypto`
- `@littlearc/auth`
- `@littlearc/observability`
- `@littlearc/config`
- `@littlearc/test-kit`
- `@littlearc/design-tokens`

The retained `@littlearc/native-compat-spike` must not appear in the root
workspace graph.

---

## 3. Scope Boundaries

### 3.1 Included

- Root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, and `turbo.json`
- Exact toolchain pins and runtime-engine enforcement
- Workspace manifests for all planned apps and packages
- Root and runtime-specific TypeScript base configurations
- Root Biome configuration
- Markdown linting configuration for repository documentation
- Root ignore and editor conventions
- A repository-owned package-boundary policy and checker
- Environment examples and a variable catalog
- Local prerequisite and validation documentation
- A temporary-clean-copy validation script
- FND-01 acceptance evidence and delivery-register updates after checks pass

### 3.2 Explicitly excluded

- Expo, Fastify, `pg-boss`, or Next.js application bootstraps (`FND-03`)
- API contracts and domain primitives (`FND-04`)
- Drizzle, migrations, PostgreSQL, or RLS (`FND-05`)
- GitHub Actions and supply-chain CI policy (`FND-02`)
- Railway services or secrets (`FND-06`)
- Runtime logging, Sentry, PostHog, or feature flags (`FND-07`)
- Changes to existing UI, theme, screen, component, or token source files
  (`FND-08`)
- Moving the ML Kit override into the root workspace; this occurs only when the
  mobile dependency graph moves in `FND-03`
- Removing or importing production code from `spikes/native-compat`
- Real credentials, provider configuration, signing material, participant
  information, or child data

---

## 4. Current Repository Inventory and Disposition

| Existing area | FND-01 disposition | Reason |
| --- | --- | --- |
| `apps/mobile/src/app/**` | Retain in place; exclude from FND-01 validation | Loose screen prototypes await `FND-08` classification |
| `apps/mobile/src/components/**` | Retain in place; exclude from FND-01 validation | Component APIs are not yet accepted production APIs |
| `apps/mobile/src/theme/**` | Retain in place; exclude from FND-01 validation | Real Unistyles registration belongs to `FND-08` |
| `packages/design-tokens/src/**` | Retain in place; exclude from source/type changes | Token intent is provisional until `FND-08` |
| `packages/design-tokens/package.json` | Normalize only workspace metadata and toolchain fields | It must join the root graph without adopting its source API |
| `spikes/native-compat/**` | Keep as an independent retained workspace | It is reproducible M0 evidence and has its own lockfile |
| `docs/**` | Keep; add FND-01 plan, local setup, and evidence | Documentation is part of the root quality boundary |

The exclusions above are named quarantine rules, not broad permanent ignores.
Their removal is an explicit `FND-08` acceptance item.

---

## 5. Technical Decisions

### 5.1 Workspace ownership

- The root `pnpm-workspace.yaml` includes `apps/*` and `packages/*` only.
- `spikes/**` is not a root workspace member. Its Node pin, lockfile, pnpm
  configuration, and narrow ML Kit override remain local until `FND-03` meets
  the recorded transfer condition.
- The root is private and non-publishable. Every application and shared package
  is also private for the MVP.
- Internal dependencies must use `workspace:*`. TypeScript path aliases must not
  imitate package imports or bypass package manifests.
- Each external dependency is declared in the workspace that imports it.
  Repository-level tools are the only root development dependencies.

This keeps pnpm's package graph as the authoritative dependency graph and gives
Turborepo real edges rather than inferred path-alias relationships.

### 5.2 Exact toolchain baseline

| Tool | FND-01 pin | Source of decision |
| --- | ---: | --- |
| Node.js | 24.18.0 | Accepted M0 runtime |
| pnpm | 11.14.0 | Accepted M0 package manager |
| Turborepo | 2.10.5 | Architecture snapshot |
| TypeScript | 6.0.3 | Expo 57-compatible M0 result |
| Biome | 2.5.4 | Architecture and M0 snapshot |
| Vitest | 4.1.10 | Accepted shared test baseline; tests begin later |
| `markdownlint-cli2` | 0.23.1 | Current stable compatible documentation tool at planning time |
| `@types/node` | 24.13.3 | Current Node 24 type line at planning time |

The root records `packageManager: pnpm@11.14.0`, exact `engines.node`, a
`.node-version`, and strict engine/peer behavior. pnpm 11.13.1 is allowed only
if the clean-install gate fails for 11.14.0 and the fallback reason is recorded
before changing the pin.

### 5.3 TypeScript configuration

- Add a strict root `tsconfig.base.json` with two-space-compatible output,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`, `useUnknownInCatchVariables`, and no implicit emit.
- Add focused bases under `tooling/typescript/` for Node, React Native, and web
  runtimes. A single configuration must not pretend that Node, DOM, and React
  Native have identical globals or module resolution.
- Add a root solution `tsconfig.json` with no source files. Add project
  references only when a workspace has real source and an explicit typecheck.
- Do not typecheck the quarantined mobile/token prototype sources in FND-01.
- Do not add a root `paths` map. Workspace package exports and
  `workspace:*` dependencies remain the import boundary.

### 5.4 Turborepo task semantics

The initial graph declares common task names without fabricating package work:

| Task | Initial behavior |
| --- | --- |
| `typecheck` | Runs real workspace typechecks; dependency typechecks run first when required |
| `test` | Declared for later packages; no package gets a fake passing test script |
| `build` | Uses dependency-first order and declared outputs only when a package really emits them |
| `dev` | Non-cached and persistent; package scripts arrive in `FND-03` |
| `clean` | Non-cached and package-local; never deletes outside known generated paths |

Static checks that inspect the repository as a whole—Biome, Markdown, package
policy, and toolchain verification—run once from root rather than once per
workspace. Build output caching is enabled only for explicitly declared output
directories. Remote caching is not configured in FND-01.

### 5.5 Dependency-boundary enforcement

Turborepo's `boundaries` command is experimental in the accepted release, so it
must not be the sole blocking control. FND-01 adds a small repository-owned
manifest-graph checker as the stable acceptance control. `turbo boundaries`
may run as an additional diagnostic, but a behavior change in an experimental
command cannot silently redefine LittleArc's architecture.

The blocking policy must detect:

1. duplicate workspace names;
2. missing `private: true`;
3. non-exact external versions;
4. internal dependencies not using `workspace:*`;
5. packages depending on applications;
6. any application depending on another application;
7. `domain` depending on Fastify, React, Expo, Next.js, Drizzle, or provider SDKs;
8. `contracts` depending on database models or `@littlearc/database`;
9. `ops-web` depending on `@littlearc/database`;
10. `mobile` depending on backend implementations or `@littlearc/database`;
11. relative imports that escape a workspace directory; and
12. root-workspace inclusion of `spikes/native-compat`.

Policy tests include one valid synthetic graph and one fixture per rejected
edge. The checker reports the source package, forbidden target, and violated
rule in a stable, actionable error.

### 5.6 Formatting and documentation

- One root `biome.jsonc` handles JavaScript, TypeScript, JSX, TSX, JSON, JSONC,
  and CSS.
- Nested Biome files are allowed only for justified runtime differences and
  must extend the root with `"extends": "//"`.
- Markdown uses `markdownlint-cli2`; Prettier and ESLint are not introduced.
- Generated, dependency, cache, build, native-generated, and explicitly
  quarantined prototype paths are excluded.
- `format` is a write command. `check` and `validate` are read-only checks and
  must never rewrite a developer's working tree.

### 5.7 Environment templates

Each future application receives its own `.env.example`; there is no shared
root `.env` that encourages secrets to leak across runtime boundaries.

Every entry has:

- variable name;
- owning application;
- required/optional state;
- `public`, `sensitive`, or `secret` classification;
- local-development meaning; and
- the later work package that validates it.

Initial templates contain only foundation-level names:

| Application | Initial variable intent |
| --- | --- |
| Mobile | public environment name and public API base URL only |
| API | environment, host/port, database URL, auth secret, bucket endpoint/credentials, and versioned key-wrapping secret placeholders |
| Worker | environment, database URL, bucket endpoint/credentials, key-wrapping secret, and provider placeholders |
| Ops web | environment, staff API origin, public base URL, and isolated staff-auth placeholders |

Secret values remain blank. Safe loopback defaults may be supplied only for
non-secret local values. `EXPO_PUBLIC_*` entries are explicitly documented as
client-visible and must never contain credentials.

---

## 6. Planned Repository Shape

```text
littlearc-v2/
├── .editorconfig
├── .gitignore
├── .node-version
├── .npmrc
├── apps/
│   ├── api/
│   │   ├── .env.example
│   │   └── package.json
│   ├── mobile/
│   │   ├── .env.example
│   │   ├── package.json
│   │   └── src/                 retained prototype files, untouched
│   ├── ops-web/
│   │   ├── .env.example
│   │   └── package.json
│   └── worker/
│       ├── .env.example
│       └── package.json
├── packages/
│   ├── auth/package.json
│   ├── config/package.json
│   ├── contracts/package.json
│   ├── crypto/package.json
│   ├── database/package.json
│   ├── design-tokens/           retained source, normalized manifest only
│   ├── domain/package.json
│   ├── observability/package.json
│   └── test-kit/package.json
├── tooling/
│   ├── boundaries/
│   │   ├── check-boundaries.mjs
│   │   ├── check-boundaries.test.ts
│   │   └── policy.mjs
│   ├── typescript/
│   │   ├── node.json
│   │   ├── react-native.json
│   │   └── web.json
│   ├── check-toolchain.mjs
│   └── validate-clean-checkout.sh
├── biome.jsonc
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── turbo.json
```

The package directories need manifests to become graph nodes. They do not need
fake `src/index.ts`, `build`, or `test` scripts in FND-01.

---

## 7. Root Command Contract

The implementation exposes these stable root commands for later CI and package
work:

| Command | Contract |
| --- | --- |
| `pnpm check:toolchain` | Fail unless Node and pnpm match the accepted exact versions |
| `pnpm check:workspace` | Validate members, package metadata, exact pins, lockfile expectations, and boundary policy |
| `pnpm check:format` | Run Biome and Markdown checks without writes |
| `pnpm typecheck` | Run all real workspace typechecks through Turborepo |
| `pnpm test` | Run real workspace tests when present; never substitute a placeholder |
| `pnpm build` | Run real workspace builds in dependency order when present |
| `pnpm check` | Run all currently required FND-01 static checks |
| `pnpm format` | Apply supported Biome formatting explicitly |
| `pnpm validate` | Run `check`, `typecheck`, and boundary policy in deterministic order |
| `./tooling/validate-clean-checkout.sh` | Verify toolchain, frozen install, and `pnpm validate` from source-only state |

`validate-clean-checkout.sh` must support a temporary source snapshot so the
acceptance run does not delete or rewrite the user's existing `node_modules`,
native build products, caches, or uncommitted work.

---

## 8. Delivery Slices

### Slice 1 — Preserve and inventory

1. Capture `git status` and the current file inventory.
2. Confirm the exact quarantine paths and retained harness state.
3. Record current Node/Corepack/pnpm availability.
4. Make no edits to prototype source or the spike dependency graph.

**Review point:** The diff contains planning/scaffold work only; no prototype
source has changed.

### Slice 2 — Root workspace and exact pins

1. Add Node, pnpm, engine, and strict-peer pins.
2. Add root package metadata and repository-tool dependencies.
3. Register `apps/*` and `packages/*` in the root workspace.
4. Create missing package directories and private manifests.
5. Normalize the design-token manifest without changing its source.
6. Generate and commit the single root lockfile.

**Review point:** `pnpm turbo ls` lists exactly 13 root workspaces and excludes
the M0 spike.

### Slice 3 — Shared configuration and task graph

1. Add strict TypeScript base and runtime-specific extensions.
2. Add root Biome and Markdown configurations with named quarantine paths.
3. Add `.editorconfig`, root ignore rules, and safe environment ignores.
4. Add the Turborepo task graph with truthful cache/output semantics.
5. Add stable root command names for `FND-02` to consume.

**Review point:** Static commands run from root and no command claims absent app
builds or tests passed.

### Slice 4 — Boundaries and environment contract

1. Implement and test the repository-owned package-graph policy.
2. Add the four `.env.example` files with blank secrets.
3. Add `docs/local-development.md` with prerequisites and commands.
4. Add `docs/environment-variable-catalog.md` with classification and owners.
5. Document the spike's isolation and later transfer trigger.

**Review point:** Every forbidden synthetic edge fails with an actionable error,
and a secret-pattern review finds no populated credentials.

### Slice 5 — Reproducibility proof

1. Run the root install with `--frozen-lockfile`.
2. Run `pnpm validate` twice; the second run must remain successful.
3. Build a source-only temporary copy containing tracked and intended new files.
4. Run `./tooling/validate-clean-checkout.sh` in that copy.
5. Confirm the root lockfile is unchanged by the frozen validation.
6. Re-run the retained harness frozen install/typecheck only if root isolation
   edits could affect it; otherwise record why it was unaffected.
7. Run `git diff --check` and scan the diff for secret-like material.

**Review point:** The clean-copy result is reproducible and does not rely on a
pre-existing module store, generated native project, or untracked config file.

### Slice 6 — Evidence and handoff

1. Record commands, versions, expected results, observed results, and any
   deviations in `docs/fnd-01-implementation-evidence.md`.
2. Update `AGENTS.md` with the new root commands and keep the spike commands.
3. Change `FND-01` to `IN PROGRESS` when implementation starts.
4. Change it to `COMPLETE` only after every acceptance criterion passes.
5. Promote `FND-03` to `READY`; keep `FND-02` waiting for stable root commands
   until the FND-01 completion review accepts them.

**Review point:** Delivery status and evidence agree; no deferred or unexecuted
check is described as passed.

---

## 9. Verification Matrix

| Area | Verification | Required result |
| --- | --- | --- |
| Toolchain | Node and pnpm checker | Exact 24.18.0 / 11.14.0 or documented approved fallback |
| Install | `pnpm install --frozen-lockfile` | Exit 0; lockfile unchanged |
| Workspace | `pnpm turbo ls` plus policy assertions | Exactly 13 members; spike excluded |
| Versions | Manifest-policy test | No ranges, tags, carets, tildes, or wildcard external versions |
| Internal links | Manifest-policy test | Every LittleArc edge uses `workspace:*` |
| Boundaries | Valid and invalid graph fixtures | Valid graph passes; every forbidden edge fails |
| TypeScript | `pnpm typecheck` | All participating packages pass; quarantine is explicit |
| Biome | `pnpm exec biome ci .` | Supported non-generated, non-quarantined files pass |
| Markdown | `pnpm exec markdownlint-cli2` | Repository Markdown passes configured rules |
| Task graph | Turborepo dry run/graph inspection | Dependency-first tasks and truthful outputs |
| Environment | Template/catalog consistency check | No undocumented variable and no populated secret |
| Clean copy | Clean-checkout script | Frozen install and validation pass from source-only state |
| Hygiene | `git diff --check` and ignored-file inspection | No whitespace errors, generated native projects, caches, or secrets |
| Regression | Retained spike isolation check | Spike lock/config remains independent and reproducible |

### 9.1 Negative scenarios

The acceptance suite must deliberately prove rejection of:

- Node 24.18.1 or pnpm 11.13.1 without the approved fallback record;
- a package version such as `^6.0.3`, `latest`, or `*`;
- a package importing an undeclared workspace dependency;
- `@littlearc/domain` depending on Fastify or Drizzle;
- `@littlearc/ops-web` depending on `@littlearc/database`;
- a package depending on `@littlearc/mobile`;
- a root workspace glob that starts including the native spike;
- a populated auth, database, bucket, or key-wrapping secret in an example;
- a build task that writes an undeclared output; and
- a validation command that rewrites files.

---

## 10. Definition of Done

`FND-01` is complete only when all of the following are true:

- [x] The root pnpm workspace and Turborepo graph exist.
- [x] All 13 planned app/package nodes are registered with unique names.
- [x] The native compatibility spike remains outside the root graph.
- [x] Node, pnpm, and repository tools are exact-pinned.
- [x] One root lockfile is committed and a frozen install does not change it.
- [x] Strict TypeScript bases exist for the different runtime families.
- [x] Biome and Markdown checks pass from root.
- [x] The stable package-boundary checker and its negative fixtures pass.
- [x] No fake build, test, or typecheck script masks missing implementation.
- [x] Environment templates and their classification catalog agree and contain
  no secret values.
- [x] The clean-checkout command passes in a temporary source-only copy.
- [x] Existing prototype sources are byte-for-byte unchanged.
- [x] The retained spike is unchanged or any unavoidable isolation edit is
  separately justified and revalidated.
- [x] Local prerequisite and root-command documentation is current.
- [x] FND-01 evidence is recorded and `docs/implementation-status.md` is updated.

Passing `FND-01` does not mean that any application runs, any native build has
been transferred, or Gate 1 has passed. It means `FND-03` and then `FND-02` can
build on a reproducible repository contract.

---

## 11. Risks, Failure Handling, and Rollback

| Risk | Early signal | Control or response |
| --- | --- | --- |
| Prototype becomes production by accident | Root checks or imports require prototype APIs | Keep named quarantine exclusions until `FND-08` |
| Spike joins root graph | Root lock contains native-spike dependencies | Assert exact member list and spike exclusion |
| Root override is copied too early | ML Kit override appears with no root consumer | Keep override local until `FND-03` transfer |
| Fake green task graph | Empty scripts print success | Disallow placeholder scripts; report skipped packages honestly |
| One TS config breaks a runtime | DOM, Node, or RN globals leak | Use runtime-specific bases |
| Experimental boundary behavior changes | Turborepo upgrade changes diagnostics | Keep repository-owned checker blocking |
| Secret enters a template | Example contains realistic credential material | Blank secret values, classification review, and secret scan |
| Cache hides missing outputs | Clean run passes, source-only run fails | Declare outputs exactly and run clean-copy validation |
| pnpm fallback becomes silent drift | Different developer lockfile/tool result | Fail exact checker; require recorded fallback decision |
| FND-01 absorbs FND-03 | Framework dependencies or runnable shells appear | Stop the slice and move that diff to the FND-03 package |

Rollback is repository-only and requires no data migration. Revert the FND-01
scaffold as one focused change while preserving all pre-existing prototypes,
documents, and the native harness. Never delete user caches, global toolchains,
or generated native directories as part of rollback.

---

## 12. Approval and Immediate Kickoff Sequence

No external provider, legal, privacy, physical-device, or product decision
blocks this synthetic foundation package.

Before implementation, engineering should approve these four package-level
choices:

1. structural workspace nodes without framework bootstraps;
2. independent retention of `spikes/native-compat` through `FND-03`;
3. a stable repository-owned boundary checker, with experimental Turborepo
   boundaries used only as a secondary diagnostic; and
4. explicit quarantine of current mobile/token prototype sources until
   `FND-08`.

Once accepted, begin Slice 1 and change the delivery register from `READY` to
`IN PROGRESS`. Do not begin with a feature screen or application generator.

---

## 13. Research Notes

- Turborepo derives its package graph from workspace package dependencies and
  uses `dependsOn` and declared outputs to create truthful task ordering and
  caching. This supports package-local dependency declarations and explicit
  outputs rather than root dependency hoisting.
- Turborepo's own support policy labels `turbo boundaries` experimental. The
  repository therefore needs a stable blocking policy under LittleArc's
  control.
- Biome 2 supports a monorepo root configuration and justified nested configs
  extending the root with `"extends": "//"`.
- TypeScript recommends separate configurations for code running in different
  environments and project references for explicit multi-project ordering.
  FND-01 prepares those bases without forcing references onto source-free
  workspace nodes.

Primary references:

- [Turborepo: configuring tasks](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks)
- [Turborepo: managing dependencies](https://turborepo.dev/docs/crafting-your-repository/managing-dependencies)
- [Turborepo: boundaries](https://turborepo.dev/docs/reference/boundaries)
- [Turborepo: support policy](https://turborepo.dev/docs/support-policy)
- [Biome: use Biome in big projects](https://biomejs.dev/guides/big-projects/)
- [TypeScript: choosing compiler options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options)
- [TypeScript: project references](https://www.typescriptlang.org/docs/handbook/project-references)

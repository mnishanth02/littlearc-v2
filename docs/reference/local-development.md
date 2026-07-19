# LittleArc Local Development

> **Status:** FND-01 foundation setup
> **Last updated:** 18 July 2026

## Prerequisites

- Node.js 24.18.0, selected through the existing version manager
- Corepack with pnpm 11.14.0
- Git
- JDK 17, Xcode, CocoaPods, and Android SDK tooling when native work begins

The root workspace enforces the exact Node and pnpm versions. It does not change
the user's global runtime default.

## First Setup

```sh
pnpm install --frozen-lockfile
pnpm validate
```

From a source-only checkout, the complete one-command proof is:

```sh
./tooling/validate-clean-checkout.sh
```

The clean-checkout command creates a temporary source snapshot, installs with
the committed lockfile, validates it, and deletes only that temporary directory.
It does not remove the current checkout's modules, caches, or native projects.

## Root Commands

| Command | Purpose |
| --- | --- |
| `pnpm check:toolchain` | Verify exact Node and pnpm versions |
| `pnpm check:workspace` | Test and enforce package, version, boundary, and environment policy |
| `pnpm check:format` | Check Biome-supported files and Markdown without writing |
| `pnpm typecheck` | Check root tooling and every real workspace typecheck through Turborepo |
| `pnpm test` | Run real workspace tests when packages provide them |
| `pnpm build` | Build real workspaces in dependency order when packages provide them |
| `pnpm validate` | Run the complete current root validation contract |
| `pnpm format` | Explicitly apply supported Biome formatting |

Application development commands are available as `pnpm dev:mobile`,
`pnpm dev:api`, `pnpm dev:worker`, and `pnpm dev:ops-web`. Mobile uses a custom
development client, not Expo Go.

Markdownlint covers maintained repository guidance and engineering documents.
The accepted long-form product-plan source is explicitly excluded because its
intentional reference/table conventions predate this toolchain baseline; FND-01
does not rewrite product content to satisfy a new formatter.

## Workspace Boundaries

- Applications may depend on packages through `workspace:*`.
- Packages never depend on applications.
- Applications never depend on other application implementations.
- Do not add TypeScript path aliases that bypass a package manifest.
- Declare an external dependency exactly where it is imported, using an exact version.
- The native M0 harness under `spikes/native-compat` remains outside the root
  workspace as retained evidence.

## Environment Files

Copy only the application example you are running, and keep the local file
untracked. All secret and sensitive examples are deliberately blank. See the
[environment variable catalog](./environment-variable-catalog.md) for ownership
and classification.

## Retained M0 Harness

The native harness keeps its own Node pin, pnpm workspace configuration, and
lockfile:

```sh
cd spikes/native-compat
pnpm install --frozen-lockfile
pnpm typecheck
pnpm run doctor
```

Do not import the harness as production code. The real mobile application now
owns the accepted native dependency graph and the root owns the narrow ML Kit
override. [ADR-0002](../adr/0002-expo-native-development-and-spike-disposition.md)
defines the remaining device-evidence and retirement trigger.

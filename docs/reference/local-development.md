# LittleArc Local Development

> **Status:** Active local-development setup
> **Last updated:** 20 July 2026

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

Local API and worker development use the repository-root `.env.aiven` file.
Keep this file untracked with mode `0600`, use an Aiven development-only
PostgreSQL service, and store synthetic fixtures only:

```dotenv
DATABASE_URL=postgresql://avnadmin:<password>@<host>:<port>/defaultdb?sslmode=require
```

`pnpm dev:api`, `pnpm dev:worker`, and `pnpm test:database:rls` load this file
through the local Aiven command wrapper while forcing `APP_ENV=local`. A missing
`.env.aiven` fails immediately. The wrapper is an implementation detail and
must not be used to bypass the local environment boundary.

The initial `avnadmin` URI is accepted only while the application skeletons do
not execute database queries. `avnadmin` can bypass RLS. Before the first
runtime database-query package, create separate Aiven login users and grant
them the existing `littlearc_app` and `littlearc_worker` group roles; replace
the runtime URI rather than using `avnadmin` for tenant traffic.

Railway owns staging configuration independently. Local Aiven credentials must
never be copied to Railway variables, staging descriptors, mobile bundles, or a
future production environment. The application-specific `.env.example` files
remain the complete variable catalog for direct package execution. All secret
and sensitive examples are deliberately blank. See the
[environment variable catalog](./environment-variable-catalog.md) for ownership
and classification.

Apply the reviewed foundation migration with the direct Aiven service URI:

```sh
aiven_uri="$(sed -n 's/^DATABASE_URL=//p' .env.aiven)"
psql "$aiven_uri" -v ON_ERROR_STOP=1 \
  -f packages/database/migrations/0001_fnd_05_database_foundation.sql
```

Do not use `db:push` against Aiven development, Railway staging, or a future
production database.

Run the Gate 1 household-isolation harness against a disposable Aiven database:

```sh
pnpm test:database:rls
```

The harness applies the reviewed migration, uses two synthetic households,
executes assertions as `littlearc_app`, and removes the temporary database,
temporary membership, and any roles it created. The configured Aiven login must
be allowed to create temporary databases and roles. The command never prints
the connection string. With `sslmode=require`, the Node harness uses standard
libpq-compatible encrypted transport. Add the Aiven service CA and move to
`sslmode=verify-full` when local certificate verification is configured.

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

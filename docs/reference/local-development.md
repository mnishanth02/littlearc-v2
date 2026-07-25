# LittleArc Local Development

> **Status:** Active local-development setup
> **Last updated:** 22 July 2026

## Prerequisites

- Node.js 26.4.0, selected through the existing version manager
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

### Expo MCP and physical-device development

Codex uses Expo's hosted MCP endpoint. Register and authenticate it once per
Codex installation:

```sh
codex mcp add expo --url https://mcp.expo.dev/mcp
codex mcp login expo
codex mcp list
```

The final command must show `expo` as enabled with OAuth authentication. The
Expo account used by Codex must match the account used by Expo CLI.

Start the mobile development client with its project-local MCP capability:

```sh
pnpm dev:mobile:mcp
```

That default command uses LAN discovery. For a USB-connected Android device on
a different or isolated Wi-Fi network, prepare the reverse tunnel and start
Metro explicitly in localhost mode:

```sh
pnpm dev:mobile:android:usb
```

This command requires exactly one authorized physical Android device. It checks
for Stay awake while USB-powered, 0.5x animations, and 60 Hz for daily
iteration, then configures these reverse rules:

```text
tcp:8081 -> tcp:8081  # Metro
tcp:3000 -> tcp:3000  # local API
```

The API rule is required because the local mobile configuration uses
`http://127.0.0.1:3000`; without the rule, that address refers to the phone
instead of the Mac. Reverse rules disappear after some disconnects or reboots,
so rerun the preparation command at the beginning of a device session. Run
`pnpm dev:android:usb` by itself when the reverse tunnel is needed without
starting Metro.

OxygenOS denies the ADB shell `WRITE_SECURE_SETTINGS` and `WRITE_SETTINGS`
permissions used to change these display/developer values. The helper reports
any mismatch without bypassing that device security boundary. Apply the named
values manually in Developer options and Display settings when the daily
profile is wanted.

Use the read-only doctor before a long validation run:

```sh
pnpm dev:android:doctor
```

Before recording acceptance evidence, manually restore normal 1x animations,
120 Hz, and standard screen timeout behavior, then verify the profile:

```sh
pnpm dev:android:acceptance
```

After forced Doze/App Standby or other device testing, remove the reverse rules,
reset synthetic battery/idle state, and verify the acceptance profile:

```sh
pnpm dev:android:cleanup
```

For a true offline test, remove the API reverse rule and use an installed build
with an embedded JavaScript bundle. Airplane mode alone does not block traffic
that still crosses an active ADB reverse rule.

Only one MCP-enabled Expo development server should run at a time. Reconnect or
restart the Codex session after starting or stopping that server so the local
device tools are rediscovered. Expo MCP traffic passes through Expo's server;
use synthetic fixtures only and never expose participant, child, credential,
OTP, cookie, or health data. See the
[official Expo MCP guide](https://docs.expo.dev/mcp/) for the current capability
and platform boundaries.

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

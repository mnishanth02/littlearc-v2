# FND-03 Implementation Evidence

> **Work package:** `FND-03`
> **Status:** Completed
> **Evidence date:** 19 July 2026
> **Last updated:** 19 July 2026
> **Toolchain:** Node.js 24.18.0, pnpm 11.14.0
> **Plan:** [FND-03 package plan](./fnd-03-application-skeletons-plan.md)

---

## 1. Implemented Skeletons

`FND-03` converted the four registered application workspace nodes into real
runtime skeletons:

- `apps/mobile`: Expo development-client app with Expo Router, safe-area
  provider, route-group shell, error boundary, deep-link redirect skeleton,
  environment loading, synthetic landing/status flow, and transferred native
  plugin configuration.
- `apps/api`: Fastify app factory and CLI entrypoint with validated local
  config, request IDs, security headers, CORS, Problem Details, `/live`, and
  `/ready`.
- `apps/worker`: Node worker process with validated config, heartbeat runtime,
  signal handling, safe lifecycle-only logs, and deferred retry/dead-letter
  placeholders owned by `FND-05`.
- `apps/ops-web`: Next.js App Router shell with staff-auth placeholder,
  runtime-status display, generated route type support, and no direct database
  dependency.

Root scripts now expose `dev:mobile`, `dev:api`, `dev:worker`, and
`dev:ops-web`. The Turborepo graph now runs real `build`, `test`, and
`typecheck` tasks for implemented application packages instead of zero-task
application placeholders.

## 2. Mobile Native Configuration Transfer

The accepted M0 native configuration was transferred into `apps/mobile`:

- Expo SDK 57.0.7, React Native 0.86.0, React 19.2.3, and TypeScript 6.0.3.
- Development client, Expo Router, SQLCipher-enabled `expo-sqlite`,
  `expo-secure-store`, local authentication, notifications, scanner, OCR, Nitro,
  Unistyles, Reanimated, Worklets, and gesture-handler dependencies.
- iOS deployment target 16.4 and Android min/compile/target SDK values 29/36/36.
- Root pnpm override for `@infinitered/react-native-mlkit-core@5.0.0`.
- Root minimum-release-age exclusions for the accepted Expo 57 package set.

Expo Doctor required two adjustments from the architecture table:

- `react-native-gesture-handler` resolved to the SDK-compatible `2.32.0`, not
  the older table value `3.1.0`.
- `react-native-reanimated` resolved to `4.5.0` and required
  `react-native-worklets@0.10.0`.

This follows the architecture rule that Expo native packages must resolve
through Expo's SDK compatibility matrix. The app also adds
`expo-system-ui@57.0.1` so `userInterfaceStyle: "automatic"` has the required
native module.

Expo Router is explicitly configured with `expo.extra.router.root: "app"`.
This prevents the current quarantined prototype files under
`apps/mobile/src/app` from becoming the production router tree before `FND-08`.

## 3. Validation Results

All commands below ran from the repository root with Node.js 24.18.0 and pnpm
11.14.0.

| Validation | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass |
| `pnpm --filter @littlearc/api test` | Pass; 3 Fastify injection tests |
| `pnpm --filter @littlearc/worker test` | Pass; 2 heartbeat/runtime tests |
| `pnpm --filter @littlearc/api build` | Pass; `dist/**` emitted |
| `pnpm --filter @littlearc/worker build` | Pass; `dist/**` emitted |
| `pnpm --filter @littlearc/mobile run typecheck` | Pass |
| `pnpm --filter @littlearc/mobile run doctor` | Pass; 20/20 checks |
| `pnpm --filter @littlearc/mobile run build` | Pass; Android and iOS native exports |
| `pnpm --filter @littlearc/mobile run native:prebuild` | Pass; native projects generated and CocoaPods installed |
| `pnpm --filter @littlearc/ops-web run typecheck` | Pass; `next typegen` plus `tsc` |
| `pnpm --filter @littlearc/ops-web build` | Pass; static root and not-found routes |
| `pnpm check:workspace` | Pass; 23 tooling tests, boundaries, environment templates |
| `pnpm check:format` | Pass; Biome and Markdown |
| `pnpm typecheck` | Pass; 4 application typecheck tasks |
| `pnpm build` | Pass; mobile, API, worker, and ops-web build tasks |
| `pnpm test` | Pass; 23 tooling tests plus 5 API/worker tests |
| `pnpm validate` | Pass |
| `./tooling/validate-clean-checkout.sh` | Pass; 151-file source-only snapshot |

The clean-checkout install logs a non-fatal `sharp@0.34.5` optional source-build
failure because the Next dependency attempts a local build after its check. pnpm
still exits successfully, Next build passes, and the root workspace allows this
known build script explicitly through `allowBuilds.sharp: true`.

## 4. Evidence Boundaries

Completed in this package:

- Runtime source and scripts exist for all four application shells.
- API liveness/readiness and Problem Details behavior are test-covered.
- Worker heartbeat and safe lifecycle logging are test-covered.
- Mobile Expo Doctor, typecheck, native export, and clean prebuild pass.
- Staff web typecheck and production build pass.
- Root validation and clean-checkout validation pass with real application tasks.

Not claimed by this package:

- Physical iOS or Android device acceptance.
- Native Android/iOS compilation of `apps/mobile` release or debug binaries.
- Staging deployment of API, worker, or staff shells.
- Real authentication, contracts, database, queue connectivity, migrations, RLS,
  observability delivery, support actions, or staff workflows.
- Adoption of quarantined prototype routes, components, theme, or design tokens.
- Any use of real child, participant, household, or medical document data.

## 5. Completion Decision

**Decision: COMPLETE.** The four application skeletons run through the accepted
root task graph, the accepted mobile native configuration is transferred to
`apps/mobile`, and all FND-03 validation available in the local synthetic M1
environment passes.

`FND-04` is the next ready package. Native harness retirement remains blocked
until the real mobile app also passes required native builds and an ADR records
the final dependency disposition.

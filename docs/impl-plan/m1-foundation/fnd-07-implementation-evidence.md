# FND-07 Implementation Evidence

> **Work package:** `FND-07`
> **Status:** Completed
> **Evidence date:** 19 July 2026
> **Last updated:** 19 July 2026
> **Toolchain:** Node.js 24.18.0, pnpm 11.14.0
> **Plan:** [FND-07 package plan](./fnd-07-observability-and-privacy-guards-plan.md)

---

## 1. Implemented Privacy Boundary

`FND-07` implements the provider-neutral observability and privacy-guard
skeleton:

- `packages/observability/src/logger.ts`: typed stable codes, code-specific
  contexts, explicit structured JSON records, bounded duration, opaque
  identifier validation, and sink-time canary checks.
- `packages/observability/src/analytics.ts`: two initial foundation events with
  compile-time property maps and exact runtime key/value validation.
- `packages/observability/src/flags.ts`: uploads, AI extraction, caregiver
  sharing, and notifications kill switches with false defaults, owners,
  expiries, provider timeout/error fallback, and no targeting context.
- `packages/observability/src/sentry.ts`: Sentry-compatible privacy guard that
  reconstructs client/server events from stable error codes and an explicit
  diagnostic allowlist.
- `packages/observability/src/canary.ts`: nested and cyclic value scanning that
  fails before sink delivery when a registered synthetic canary is present.
- `packages/observability/src/factory.ts`: delivery-disabled analytics, error,
  flag, and log factories for client and web runtimes.
- `apps/api`: shared safe request-completion logs with request ID, bounded
  duration, outcome, service, version, environment, severity, and stable code.
- `apps/worker`: shared lifecycle codes replace the worker-local open event
  shape and no longer expose queue or application configuration in logs.
- `apps/mobile`: delivery-disabled observability factory and a stable generic
  error screen that does not render or report the raw error message.
- `apps/ops-web`: delivery-disabled server-side observability factory.

No PostHog or Sentry SDK, telemetry credential, installation identity, session
replay, autocapture, screenshot, attachment, request body, user context, or
network delivery was added.

## 2. Canary and Adversarial Coverage

The observability package has 16 focused tests across five files. The fixtures
seed synthetic child-name, email, birth-date, OCR-text, token, private-path,
and record-title canaries.

The tests verify:

- Nested values, object keys, and cyclic inputs are scanned safely.
- Logger output is reconstructed from code-specific allowlists; extra runtime
  fields are absent and invalid identifiers/durations fail before delivery.
- Analytics remains disabled by default and rejects unknown events, extra
  properties, free text, and values outside bounded enums.
- All four flags default false, have owners and expiries, receive no targeting
  context, and fail closed on provider absence, rejection, timeout, or expiry.
- Sentry events drop headers, cookies, query strings, bodies, user data,
  breadcrumbs, attachments, paths, raw messages, contexts, and arbitrary tags.
- API request logging does not retain a seeded canary placed in a query string.
- Worker lifecycle logs contain only the shared stable record shape.

## 3. Validation Results

All commands ran from the repository root with Node.js 24.18.0 and pnpm
11.14.0.

| Validation | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass after the workspace dependency lockfile was refreshed |
| `pnpm --filter @littlearc/observability typecheck` | Pass |
| `pnpm --filter @littlearc/observability test` | Pass; 16 tests in 5 files |
| `pnpm --filter @littlearc/observability build` | Pass |
| `pnpm --filter @littlearc/api test` | Pass; 7 Fastify injection tests |
| `pnpm --filter @littlearc/api typecheck` | Pass |
| `pnpm --filter @littlearc/worker test` | Pass; 2 worker lifecycle tests |
| `pnpm --filter @littlearc/worker typecheck` | Pass |
| `pnpm --filter @littlearc/mobile typecheck` | Pass |
| `pnpm --filter @littlearc/ops-web typecheck` | Pass |
| `pnpm check:workspace` | Pass; 26 tooling tests and all accepted workspace policies |
| `pnpm check:format` | Pass; Biome and Markdown |
| `pnpm check:docs` | Pass |
| `pnpm typecheck` | Pass; tooling and 12 package/application tasks |
| `pnpm test` | Pass; all configured unit and contract suites |
| `pnpm build` | Pass; all configured package and application builds |
| `pnpm validate` | Pass |
| `git diff --check` | Pass |
| `./tooling/validate-clean-checkout.sh` | Pass in a 248-file source-only snapshot |

Clean-checkout install still prints the known non-fatal `sharp@0.34.5`
source-build message, then exits successfully and completes validation.

## 4. Evidence Boundaries

Completed in this package:

- Stable, typed log codes and bounded structured-log output exist.
- Analytics event/property and feature-flag name definitions are compile-time
  allowlisted and runtime guarded.
- The four required kill switches fail closed.
- A client/server Sentry-compatible positive-allowlist scrubber exists.
- Synthetic leakage canaries exercise logs, analytics, flags, and error events.
- API, worker, mobile, and staff shells adopt the shared boundary appropriate to
  their current foundation behavior.
- The root task graph, source-only install, tests, types, builds, formatting,
  generated-output checks, and documentation checks pass.

Not claimed by this package:

- A live PostHog or Sentry organization, EU project, DSN, API key, dashboard,
  alert, retention rule, sampling rule, or network-delivery path.
- Processor approval, DPA completion, processor inventory, or permission to
  handle real child or participant data.
- Product analytics beyond the two fixed foundation events.
- Metrics backend, distributed tracing, queue telemetry, or incident alerting.
- Upload, AI, sharing, notification, email, or push provider behavior.

## 5. Completion Decision

**Decision: COMPLETE for the accepted FND-07 provider-neutral skeleton.** The
shared package now prevents open telemetry payloads, enforces bounded log and
analytics shapes, supplies false-default kill switches, rebuilds error events
from stable diagnostics, detects seeded sensitive canaries before delivery,
and is adopted by the four application shells without enabling an external
processor.

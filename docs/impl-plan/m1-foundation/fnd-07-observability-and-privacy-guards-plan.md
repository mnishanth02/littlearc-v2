# FND-07 Observability and Privacy Guards

> **Status:** Completed
> **Started date:** 19 July 2026
> **Last updated:** 19 July 2026
> **Completion date:** 19 July 2026
> **Owner:** Engineering
> **Milestone:** M1
> **Work package:** `FND-07`
> **Depends on:** `FND-01` through `FND-06`
> **Acceptance evidence:** [FND-07 implementation evidence](./fnd-07-implementation-evidence.md)
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
> **Inputs:** [Implementation roadmap](../roadmap.md),
> [architecture](../../core/littlearc-architecture-and-tech-stack.md),
> [environment catalog](../../reference/environment-variable-catalog.md), and
> [delivery dashboard](../../IMPLEMENTATION_STATUS.md)

---

## Outcome

`FND-07` establishes the privacy-safe observability boundary that every later
feature must use before it can emit logs, analytics, feature-flag evaluations,
or error reports.

The observable outcome is:

- `@littlearc/observability` exposes stable log codes and a JSON logger that
  accepts only bounded operational metadata.
- Analytics events and properties are compile-time allowlisted and validated
  again at runtime before reaching an injected sink.
- Feature flags have safe local defaults, an owner, an expiry, and no user,
  child, household, health, or record targeting context.
- Uploads, AI extraction, caregiver sharing, and notifications are disabled
  when no provider is configured, a provider fails, or its response is invalid.
- Sentry-compatible client and server `beforeSend` guards retain only an
  explicit diagnostic allowlist and discard request bodies, headers, cookies,
  user data, breadcrumbs, dynamic messages, paths, and arbitrary extras.
- Tests seed synthetic sensitive canaries and fail if any canary reaches a log,
  analytics payload, flag evaluation, or scrubbed error event.
- API and worker lifecycle behavior uses the shared safe logger; client and web
  runtimes receive delivery-disabled observability factories for later wiring.

## Scope

Included:

- A framework-independent TypeScript package that works in Node.js, React
  Native, and browser/server-rendered web runtimes without importing platform
  SDKs.
- Stable, centrally defined foundation log codes for API and worker lifecycle
  and request events.
- Explicit structured-log fields: timestamp, severity, service, version,
  environment, code, request or job ID, bounded duration, and outcome.
- A small initial analytics event catalogue whose property keys and value
  domains are fixed in source.
- Feature-flag definitions for uploads, AI extraction, caregiver sharing, and
  notifications, all defaulting to disabled.
- Provider-neutral sinks so PostHog and Sentry adapters can be added without
  changing application call sites.
- A Sentry-compatible scrubber and stable error-code reporter that do not
  forward raw errors.
- Synthetic canary leakage scanning across nested arrays and objects.
- Focused unit tests, API/worker integration tests, documentation, status, and
  validation evidence.

## Out Of Scope

- Creating or configuring PostHog or Sentry organizations, EU projects, DSNs,
  API keys, credentials, dashboards, alerts, sampling rules, or retention.
- Enabling network delivery to PostHog, Sentry, or another telemetry provider.
- Session replay, autocapture, heatmaps, screenshots, view hierarchies,
  attachments, request/response bodies, or automatic user association.
- Product analytics beyond the initial foundation event catalogue.
- User-, household-, child-, record-, file-, provider-, health-, search-, or
  location-based analytics or feature-flag targeting.
- Metrics backends, distributed tracing, queue-depth collection, protected
  worker operations endpoints, or production incident alerting.
- Upload, AI, sharing, notification, email, or push provider implementation.
- Real child, participant, household, medical document, or production support
  data.
- Production Railway setup, which remains deferred after `FND-06`.

## Dependencies

- `FND-01` provides the workspace, TypeScript, Biome, Vitest, and package
  boundary policy.
- `FND-03` provides the API, worker, mobile, and staff application shells.
- `FND-04` provides stable contract and Problem Details conventions.
- `FND-05` provides database and worker foundation metadata used by current
  lifecycle events.
- `FND-06` provides the accepted staging-only environment skeleton.
- The architecture's accepted PostHog/Sentry EU direction remains subject to
  privacy review before delivery is enabled. This package therefore prepares
  and tests the privacy boundary without configuring a processor.

## Module Status

| Module | Status | Notes |
| --- | --- | --- |
| Package brief and acceptance boundary | Completed | This plan |
| Shared observability package | Completed | Logger, analytics, flags, Sentry scrubber, canary scan |
| API and worker adoption | Completed | Shared lifecycle and safe request logs implemented |
| Mobile and staff factories | Completed | Delivery-disabled cross-runtime entry points implemented |
| Canary and integration tests | Completed | Seeded values fail or are absent across every output channel |
| Documentation and evidence | Completed | See implementation evidence |
| Provider delivery | Deferred | Requires EU projects, configuration, and processor review |

## Implementation Plan

1. Scaffold `@littlearc/observability` with build, test, and typecheck tasks and
   a single public entry point.
2. Define runtime-neutral observability primitives, stable codes, safe field
   enums, and explicit serialized record shapes.
3. Implement a JSON logger that reconstructs output from allowlisted fields,
   clamps durations, rejects invalid identifiers, and scans the final record
   for registered canaries before invoking its sink.
4. Implement a fixed analytics event map, runtime property validation, and a
   disabled-by-default injected sink. Reject unknown events, extra properties,
   unbounded counts, free text, and canary values.
5. Implement the four foundation feature flags with documented owners,
   ISO-date expiries, false defaults, provider timeout/error fallback, and no
   dynamic targeting context.
6. Implement Sentry-compatible client/server scrubbers and a stable-code error
   reporter. Rebuild events from an allowlist instead of attempting to remove
   known-bad fields from an open payload.
7. Add synthetic name, email, birth-date, OCR-text, token, file-path, and
   record-title canaries. Exercise every observability channel and nested input
   shape, including provider failures and unknown properties.
8. Adopt the shared logger in API request completion and worker lifecycle paths.
   Add delivery-disabled mobile and staff factories without changing visible UI.
9. Run focused validation, inspect the diff, then run repository-wide
   validation and clean-checkout proof.
10. Record implementation evidence and align this plan, the M1 index, context
    map, environment reference if affected, and delivery dashboard.

## Acceptance Criteria

- Later code can emit a structured log only through a stable code and the
  bounded `SafeLogContext` fields.
- Runtime objects containing extra or prohibited fields cannot pass those
  fields to a log or analytics sink.
- Analytics call sites are compile-time constrained to the central event and
  property map, and runtime validation fails closed for untyped input.
- Every flag definition has a false safe default, owner, expiry, and no
  sensitive targeting context; provider absence, error, timeout, or invalid
  response returns false.
- Client and server Sentry guards expose only stable codes and explicitly safe
  diagnostics; raw error messages and arbitrary event fields are not retained.
- Seeded canaries are absent from every captured output, and a direct canary
  leak causes a test-visible failure before sink delivery.
- API request logs contain request ID, duration, outcome, service, environment,
  version, and stable code without method, URL, query, headers, or body.
- Worker logs retain lifecycle and safe foundation state without job payloads,
  credentials, URLs, or provider responses.
- No provider SDK, DSN, token, credential, or real data is committed or enabled.
- Focused tests, root validation, and clean-checkout validation pass before the
  work package is marked complete.

## Validation

Focused checks:

- `pnpm --filter @littlearc/observability test`
- `pnpm --filter @littlearc/observability typecheck`
- `pnpm --filter @littlearc/observability build`
- `pnpm --filter @littlearc/api test`
- `pnpm --filter @littlearc/api typecheck`
- `pnpm --filter @littlearc/worker test`
- `pnpm --filter @littlearc/worker typecheck`
- `pnpm --filter @littlearc/mobile typecheck`
- `pnpm --filter @littlearc/ops-web typecheck`

Broad checks:

- `pnpm check:workspace`
- `pnpm check:format`
- `pnpm check:docs`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm validate`
- `git diff --check`
- `./tooling/validate-clean-checkout.sh`

## Evidence

[FND-07 implementation evidence](./fnd-07-implementation-evidence.md) records
the accepted focused, broad, and clean-checkout validation results.

## Risks And Blockers

| Risk | Control | Residual obligation |
| --- | --- | --- |
| Types alone can be bypassed by untyped runtime data | Rebuild payloads from allowlists and validate at runtime | Keep adversarial tests with every new event or field |
| Scrubbing a provider-native event can miss future SDK fields | Rebuild a minimal event instead of forwarding an open object | Re-run canaries when a Sentry SDK adapter is introduced |
| Flags accidentally become identity or health targeting | Provider interface accepts only a flag name | Require a later reviewed API change for any targeting context |
| False defaults can disable unfinished workflows | This is intentional fail-closed foundation behavior | Owning feature package must explicitly wire and test enablement |
| Arbitrary expiry dates become stale | Keep expiry in the central definition and add an expiry assertion | Owners must renew or remove flags before expiry |
| No external delivery means hosted scrubbing is unproven | Keep delivery disabled | Validate EU projects, processor terms, and live canaries before enabling |

## Decisions

- Use provider-neutral sinks in `FND-07`; provider SDK installation and network
  delivery require a later explicit review because they add processor and
  platform behavior.
- Reconstruct outbound records from positive allowlists. Key-name redaction is
  secondary defense, not the primary privacy boundary.
- Keep installation identity out of the initial skeleton. A random diagnostic
  installation ID may be added only with storage, rotation, and non-linkage
  tests.
- Keep flag evaluation context-free in this package. This prevents accidental
  child, household, record, or health targeting.
- These package-level choices implement already accepted architecture and do
  not create a new provider or data-handling decision requiring an ADR.

## Follow-Up

- Provider SDK adapters, EU project configuration, DPAs, processor inventory,
  retention, sampling, dashboards, alerting, and live delivery canaries remain
  deferred until the owning operational package and privacy review authorize
  them.
- Product events must be added one by one with bounded properties and leakage
  tests in their owning work packages.
- Metrics, traces, queue telemetry, and incident alerting remain owned by later
  reliability and operations packages.

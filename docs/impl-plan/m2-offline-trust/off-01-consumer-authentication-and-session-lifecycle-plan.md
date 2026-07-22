# OFF-01 Consumer Authentication and Session Lifecycle

> **Status:** Complete
> **Started date:** 20 July 2026
> **Last updated:** 20 July 2026
> **Completion date:** 20 July 2026
> **Owner:** Engineering
> **Milestone:** M2
> **Work package:** `OFF-01`
> **Depends on:** Accepted Gate 1 and the accepted `OFF-02` companion plan
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
> **Inputs:** [roadmap](../roadmap.md),
> [architecture](../../core/littlearc-architecture-and-tech-stack.md),
> [mobile flow](../../core/mobile-application-flow.md), and
> [backend data model](../../core/backend-data-model-and-database-schema.md)

---

## Outcome

LittleArc has one self-hosted consumer-authentication boundary at `/v1/auth`
that supports passwordless email OTP, production-gated Apple and Google
configuration, stateful PostgreSQL sessions, remote session listing and
revocation, a recent-authentication policy primitive, and an Expo client whose
session cookies are stored only through SecureStore. The package is verifiable
with synthetic identities and a captured OTP without enabling real child data
or depending on organization-owned provider credentials.

## Scope

Included:

- Turn `@littlearc/auth` into the only package that constructs consumer Better
  Auth and owns authentication/session policy.
- Pin Better Auth and its Expo/Drizzle integrations at `1.6.23`; generate the
  reviewed raw artifact with the exact-version `auth@1.6.23` CLI, but do not
  retain the CLI's unrelated optional adapters in the runtime workspace.
- Keep Better Auth's global identity tables separate from household-owned RLS
  records. Identity rows contain no household or child content.
- Mount the Fetch-compatible Better Auth handler in Fastify at `/v1/auth/*`
  without logging request bodies, email addresses, OTPs, cookies, or tokens.
- Implement email OTP first with a six-digit, five-minute, hashed, single-use
  code, three verification attempts, resend rotation, and always-enabled
  endpoint rate limits.
- Return enumeration-safe OTP request responses and normalize email only inside
  the auth boundary.
- Require explicit trusted origins, keep CSRF/origin checks enabled, disable
  password authentication, and disable implicit account linking.
- Configure seven-day stateful sessions, daily rotation, a ten-minute
  recent-authentication window, session listing, selected-session revocation,
  all-other-session revocation, and sign-out.
- Add a reusable recent-authentication assertion for later export, deletion,
  account linking, and sensitive settings.
- Add the Expo Better Auth client with the `littlearc` scheme, a fixed storage
  prefix, SecureStore, the email-OTP client plugin, and no AsyncStorage fallback.
- Add validated environment contracts for the auth secret, public auth base
  URL/trusted origins, optional provider credentials, and email delivery mode.
- Add focused policy, configuration, route, schema, leakage, and lifecycle
  tests, plus real PostgreSQL migration/integration evidence when the configured
  Aiven test target is available.

## Out Of Scope

- Household creation, membership, roles/capabilities, parent or child profiles,
  consent, adult verification, encrypted payloads, or RLS policy for tenant
  data; these belong to `OFF-02`.
- A finished authentication screen stack or device/local database enrollment;
  OFF-01 provides the typed client boundary, while product screens arrive in
  the package that can safely complete onboarding.
- Staff authentication, passkeys, support impersonation, or privileged staff
  sessions.
- Passwords, password reset, phone OTP, magic links, or anonymous sessions.
- Enabling Apple, Google, or Resend in a shared environment before
  organization-owned credentials and lifecycle checks are available.
- Treating local/synthetic tests as proof of live provider callback, email
  deliverability, store build, physical-device, or account-recovery behavior.

## Dependencies

- Gate 1 is complete and the root toolchain remains Node 24.18.0 with pnpm
  11.14.0.
- The `OFF-02` companion plan resolves the shared role/country/schema boundary:
  co-parent is a caregiver capability bundle for MVP, server-side household
  country has no silent default, and adult-verification evidence remains gated.
- The provider-owned auth schema is generated from Better Auth 1.6.23 rather
  than copied from the planning document.
- Only synthetic identities may be used. Real participants and child data
  remain blocked by the pre-real-data gates.
- `RDY-09` remains the trigger for live Apple, Google, email-provider, signing,
  store, credential-custody, and recovery evidence.

## Module Status

| Module | Status | Notes |
| --- | --- | --- |
| Plan and shared OFF-02 decisions | Completed | Both standalone plans passed documentation and consistency review. |
| Provider schema and migration | Completed | Pinned raw schema, deterministic namespace adaptation, reviewed forward SQL, and grants accepted. |
| `@littlearc/auth` server policy | Completed | Email OTP, origins, sessions, linking, providers, delivery, and recent-auth policy accepted. |
| Fastify integration | Completed | `/v1/auth/*` forwards Fetch status/headers/cookies and reports foundation readiness when configured. |
| Expo client boundary | Completed | Better Auth Expo client uses SecureStore, the `littlearc` scheme, and a fixed prefix. |
| Focused automated validation | Completed | OTP policy, configuration, schema, route, lifecycle, leakage, and Aiven cases passed. |
| Live provider/device validation | Blocked | Requires organization credentials and the named pre-pilot device matrix. |
| Evidence and delivery status | Completed | Accepted evidence distinguishes automated/Aiven proof from live provider/device obligations. |

## Implementation Plan

1. Record the auth/session ADR and generate the Better Auth 1.6.23 Drizzle
   schema with the Expo and email-OTP plugins enabled. Keep generated identity
   tables global and provider-owned; do not attach household RLS or child data.
2. Add a reviewed forward `OFF-01` migration for the generated user, account,
   session, verification, and database rate-limit tables. Register it in the
   existing deterministic migration generator and drift checks.
3. Implement `createConsumerAuth` in `@littlearc/auth` with injected database
   and OTP delivery ports. Enforce the origin, account-linking, passwordless,
   OTP, session, and anti-abuse policy in one configuration.
4. Provide a capture-only OTP delivery adapter for tests/local deterministic
   development. Production/staging must fail closed unless an approved delivery
   adapter and required configuration are present; codes never enter logs.
5. Mount the auth handler in Fastify, preserve Fetch response status/headers,
   keep errors generic at the HTTP boundary, and expose auth readiness without
   claiming provider connectivity.
6. Add a platform-neutral recent-authentication policy helper and tests for
   fresh, stale, missing, and invalid session timestamps.
7. Initialize the Expo client through `@better-auth/expo/client` and
   `expo-secure-store`, using `/v1/auth`, the `littlearc` scheme, and the
   email-OTP client plugin. Export only the client/session operations needed by
   future screens.
8. Test enumeration-safe OTP requests, expiry, attempt exhaustion, single use,
   rate limiting, session creation/list/revocation/sign-out, hostile origins,
   implicit-linking configuration, secure mobile storage configuration, and
   sensitive-canary absence.
9. Run focused package/API/database/mobile checks, real PostgreSQL forward and
   lifecycle integration when available, then root validation and clean-
   checkout proof. Record evidence boundaries before changing status.

## Acceptance Criteria

- No password endpoint is enabled and no password field is added to LittleArc
  contracts. The reviewed provider-generated account model retains its nullable,
  unused compatibility column; LittleArc never exposes or populates it.
- The committed Drizzle schema and reviewed SQL match the pinned Better Auth
  configuration, including plugins and database-backed rate limits.
- Auth identity tables contain only identity/session/provider/verification
  fields and no household, child, health, document, or consent content.
- OTP request responses do not disclose whether an email already exists; the
  code is hashed at rest, expires after five minutes, is single-use, and is
  invalidated after three failed attempts.
- Auth endpoint rate limiting is enabled in every environment and does not rely
  on one-process memory for shared staging/production enforcement.
- Only explicit configured web/app origins are trusted; production configuration
  rejects wildcard Expo development origins.
- Implicit provider linking is disabled. Explicit linking is unavailable until
  a recent-authenticated UI and live-provider verification are delivered.
- Sessions are stateful, server-revocable, listable per user, and eligible for
  sensitive actions only inside the ten-minute freshness window.
- Fastify forwards Better Auth response status and all `Set-Cookie` headers
  without exposing request bodies or tokens to observability.
- The Expo client uses the Better Auth Expo plugin and SecureStore with no
  AsyncStorage or plaintext persistence path.
- Automated tests use synthetic identities and prove auth/session lifecycle and
  privacy canaries; PostgreSQL claims are supported by a real database harness.
- Dashboard, plan, ADR, migration metadata, environment catalog, and evidence
  agree on what is complete versus provider/device-blocked.

## Validation

Focused checks:

- `pnpm --filter @littlearc/auth test`
- `pnpm --filter @littlearc/auth typecheck`
- `pnpm --filter @littlearc/database test`
- `pnpm --filter @littlearc/api test`
- `pnpm --filter @littlearc/mobile typecheck`
- `pnpm check:generated`
- `pnpm check:environment`
- `pnpm check:docs`

Integration and broad checks:

- `pnpm test:database:auth` when the Aiven synthetic test target is available
- `pnpm test`
- `pnpm build`
- `pnpm validate`
- `git diff --check`
- `./tooling/validate-clean-checkout.sh`

Manual/live evidence remains separate: real email delivery, Apple and Google
callbacks, physical-device SecureStore persistence, deep links, remote revoke,
store-track install/upgrade, and credential recovery.

## Evidence

[OFF-01 implementation evidence](./off-01-implementation-evidence.md) records
the passing synthetic/local/Aiven checks and keeps live-provider and pre-pilot
device evidence explicitly blocked.

## Risks And Blockers

| Risk or blocker | Control | Residual obligation |
| --- | --- | --- |
| Better Auth generated schema drifts | Commit the raw 1.6.23 output, test its runtime model shape, and register deterministic namespace adaptation drift. | Regenerate with exact-version CLI and review on every Better Auth/plugin change. |
| OTP endpoint leaks account existence or codes | Uniform response, hashed OTP, bounded logger, canary tests. | Validate live email timing/delivery before pilot. |
| In-memory rate limits fail across replicas | Use Better Auth database rate-limit storage. | Load-test and tune with staging traffic. |
| Social login links accounts by email | Disable implicit linking and trusted-provider shortcuts. | Build deliberate recent-auth linking UX later. |
| SecureStore works in types but not device lifecycle | Use Expo plugin only and keep device validation blocked. | Pass physical iOS/Android persistence/revoke checks pre-pilot. |
| Provider credentials are unavailable | Keep providers configuration-gated and fail closed. | `RDY-09` supplies owned credentials, custody, rotation, and recovery. |

## Decisions

- Use Better Auth provider-owned global identity tables in the existing
  `littlearc` schema; household RLS starts only after a membership selects a
  tenant in `OFF-02`.
- Use database-backed Better Auth rate-limit storage rather than Redis or
  process-local storage.
- Use hashed, rotating OTPs. A resend creates a new valid code; delayed older
  codes fail safely.
- Use seven-day stateful sessions, daily rotation, and a ten-minute
  recent-authentication window. These are security defaults subject to later
  observed-risk review, not retention-law claims.
- Keep Apple, Google, and external email delivery disabled unless complete
  environment configuration is present.

## Follow-Up

- `OFF-02` consumes the authenticated user ID and recent-auth policy while
  implementing household ownership, consent, adult-verification gating, and
  tenant authorization.
- `OFF-03` owns device enrollment, local key provisioning, biometric invalidation,
  and signed-out local-data wiping.
- The pre-pilot gate owns organization-provider callbacks, physical-device
  SecureStore/deep-link/revoke checks, store tracks, rotation, custody, and
  recovery evidence.

# OFF-01 Implementation Evidence

> **Status:** Accepted
> **Last updated:** 22 July 2026
> **Owner:** Engineering
> **Work package:** `OFF-01`
> **Plan:** [OFF-01 Consumer Authentication and Session Lifecycle](./off-01-consumer-authentication-and-session-lifecycle-plan.md)
> **Decision:** [ADR-0009](../../adr/0009-consumer-authentication-and-session-boundary.md)

---

## 1. Accepted Outcome

LittleArc now has one self-hosted consumer-authentication boundary at
`/v1/auth`. It supports passwordless email OTP, explicit configuration-gated
Apple and Google providers, PostgreSQL-backed rate limits and sessions, session
listing/revocation/sign-out, a ten-minute recent-authentication policy, and an
Expo client that delegates cookie persistence only to SecureStore.

The implementation uses synthetic identities only. It creates no household,
parent, child, consent, adult-verification, or restricted health data; those
remain in the accepted `OFF-02` plan and later real-data gates.

## 2. Implemented Boundary

- `@littlearc/auth` owns Better Auth 1.6.23 configuration, exact-origin
  enforcement, email OTP delivery, social-provider configuration, stateful
  session policy, and recent-authentication checks.
- Email OTPs are six digits, expire after five minutes, rotate on resend, are
  hashed at rest, allow three verification attempts, and use shared database
  rate-limit state when PostgreSQL is configured.
- The Fastify application forwards Better Auth status, response headers, and
  every `Set-Cookie` value through `/v1/auth/*`. Existing bounded request logs
  do not include paths, bodies, email addresses, OTPs, cookies, or tokens.
- The mobile client uses `@better-auth/expo`, Expo SecureStore, the `littlearc`
  scheme, the `littlearc.auth` prefix, and the email-OTP client plugin. There is
  no AsyncStorage or plaintext fallback.
- The API environment contract fails closed on partial core or social-provider
  configuration. Provider credentials remain blank in repository templates.

## 3. Schema and Migration Review

The exact-version `auth@1.6.23` CLI generated the committed raw Drizzle schema.
A deterministic adapter replaces only the table constructor so the runtime
schema uses the accepted `littlearc` namespace. Generated-output checks run the
adapter and the database migration writer and reject drift.

Migration `0002_off_01_consumer_auth.sql` creates `auth_user`, `auth_account`,
`auth_session`, `auth_verification`, and `auth_rate_limit`. These are global
provider-owned tables with no household, child, health, document, or consent
columns. `littlearc_app` receives lifecycle access; worker and operations roles
receive none.

Better Auth generates a nullable `auth_account.password` compatibility column
even with password authentication disabled. LittleArc exposes no password
endpoint or contract and never populates the column. ADR-0009 records why it is
retained rather than introducing unsupported provider-schema drift.

## 4. PostgreSQL Lifecycle Evidence

`pnpm test:database:auth` passed against Aiven PostgreSQL 17.10. The harness:

1. created a fresh temporary database;
2. applied the accepted FND-05 and OFF-01 forward migrations;
3. verified API write grants and absence of worker/operations read grants;
4. requested an OTP through a capture-only synthetic delivery adapter;
5. proved the persisted verification value did not contain the delivered code;
6. established and listed two sessions for one synthetic identity;
7. revoked the selected remote session and proved it no longer authenticated;
8. retained only the second session and cleaned up the temporary database.

The reported PostgreSQL 17.10 provider version remains a known deferred
target-version alignment item. No PostgreSQL 18-specific behavior is claimed.

## 5. Validation Results

All commands used Node.js 24.18.0 and pnpm 11.14.0.

| Validation | Result |
| --- | --- |
| `pnpm --filter @littlearc/auth test` | Passed; 10 OTP, session, origin, rate-limit, and recent-authentication tests. |
| `pnpm --filter @littlearc/database test` | Passed; 16 migration, schema, and primitive tests. |
| `pnpm --filter @littlearc/api test` | Passed; 9 route, configuration, readiness, and privacy-safe logging tests. |
| Focused auth/database/API/mobile typechecks | Passed, including the PostgreSQL integration harness. |
| `pnpm --filter @littlearc/mobile run doctor` | Passed all 20 Expo project checks. |
| Expo MCP configuration | Passed; the hosted Expo endpoint is enabled with OAuth, `expo-mcp` 0.2.4 is installed as a mobile development dependency, and the MCP-enabled development-client server bundled the Android application. |
| Pixel 8 physical-device probe | Passed on Android 17/API 37; the Better Auth Expo client initialized, SecureStore wrote/read/deleted a synthetic value, and the `littlearc:///off-01-validation` Android intent opened the development-only validation route. |
| `pnpm test:database:auth` | Passed against Aiven PostgreSQL 17.10 with hashed OTP and remote-revocation proof. |
| `pnpm check:generated` twice | Passed; three registered generators were idempotent and drift-free. |
| `pnpm check:environment` | Passed; all four application templates match the catalog. |
| `pnpm test` | Passed; 111 tooling, unit, and contract tests across the workspace. |
| `pnpm build` | Passed; package/server/staff builds and Android/iOS Hermes exports completed. |
| `pnpm validate` | Passed; toolchain, workspace, supply-chain, generated output, formatting, documentation, and 13-package typechecks passed. |
| `git diff --check` | Passed. |
| `./tooling/validate-clean-checkout.sh` | Passed from a 305-file source-only snapshot with a frozen install and uncached 13-package typecheck graph. |

The standalone `pnpm peers check` remains non-green because
`openapi-typescript@7.13.0` declares TypeScript `^5.x` while the root uses the
accepted TypeScript 6.0.3 pin. This pre-existing toolchain metadata mismatch was
not introduced by Expo MCP or OFF-01. The OpenAPI generator, typechecks, builds,
root validation, and clean-checkout proof all pass; the mismatch remains a
non-blocking toolchain follow-up.

The first clean-checkout attempt failed because unused optional Better Auth
peers (`@prisma/client` and `better-sqlite3`) had unapproved install scripts.
They are now explicitly marked `allowBuilds: false`; the selected
Drizzle/PostgreSQL path requires neither package. Frozen install, supply-chain
checks, and the complete clean-checkout validation then passed. Sharp emitted
its existing optional source-build fallback message during the successful
install; pnpm continued and validation completed.

## 6. Evidence Boundaries

The 22 July physical-Android follow-up used the existing debug development
client with the current MCP-enabled JavaScript bundle. UIAutomator observed the
three passing states, a screenshot was visually reviewed, and the bounded
logcat scan found neither a fatal React Native/application error nor the
synthetic SecureStore key or value. The probe deletes its synthetic value and
is excluded from non-development navigation.

This dossier does not claim:

- live Resend delivery, timing, bounce, or recovery behavior;
- Apple or Google callback, scope, linking, or credential-rotation behavior;
- persistence of a real Better Auth cookie or session across restart or
  upgrade, physical-device remote revocation, provider callback handling,
  physical iOS behavior, production install/upgrade, or signed-store builds;
- physical-device accessibility acceptance for this diagnostic screen or the
  broader pre-pilot device capability matrix; or
- real participant, parent, child, consent, identity-document, or health data.

Those checks remain blocked by organization-owned credentials, `RDY-09`, the
pre-pilot device matrix, and the named privacy/legal/security gates.

## 7. Completion Decision

**Decision: COMPLETE.** OFF-01 meets its synthetic implementation boundary,
has real PostgreSQL lifecycle evidence, and now has a bounded physical-Android
SecureStore and deep-link proof. `OFF-02` is the next ready work package; it
must consume this identity/session boundary rather than expanding OFF-01 into
household authorization or real-data handling.

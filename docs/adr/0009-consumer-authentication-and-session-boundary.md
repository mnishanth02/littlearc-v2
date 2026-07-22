# ADR-0009: Consumer Authentication and Session Boundary

> **Status:** Accepted
> **Date:** 2026-07-20
> **Owner:** Engineering
> **Review date:** 2026-10-20
> **Supersedes:** None
> **Superseded by:** None
> **Related documents:** [OFF-01 plan](../impl-plan/m2-offline-trust/off-01-consumer-authentication-and-session-lifecycle-plan.md), [architecture](../core/littlearc-architecture-and-tech-stack.md), and [backend data model](../core/backend-data-model-and-database-schema.md)

---

## Context

LittleArc needs consumer authentication before household authorization and
offline device enrollment can be implemented. The boundary must support a
passwordless mobile product, remote session revocation, explicit provider
configuration, privacy-safe logging, and synthetic validation without treating
provider credentials or physical-device behavior as available evidence.

## Decision

Use one self-hosted Better Auth 1.6.23 configuration owned by
`@littlearc/auth` and mounted by Fastify at `/v1/auth/*`.

- Launch with six-digit, five-minute email OTPs stored as SHA-256 hashes, with
  three verification attempts, rotating resends, and database-backed rate
  limiting. Password endpoints remain disabled.
- Persist global provider-owned `auth_user`, `auth_account`, `auth_session`,
  `auth_verification`, and `auth_rate_limit` tables in the `littlearc` schema.
  They contain no household or child content and are not tenant-RLS tables.
- Grant the API role lifecycle access and revoke auth-table access from worker
  and operations roles. Household authorization begins with `OFF-02`.
- Keep stateful sessions for seven days, rotate them daily, permit session
  listing and revocation, and use a ten-minute recent-authentication policy for
  later sensitive operations.
- Require exact trusted origins at the LittleArc handler boundary, disable
  implicit provider linking, and enable Apple and Google only when their full
  credential pairs are configured.
- Use the Better Auth Expo client with Expo SecureStore, the `littlearc` scheme,
  and a fixed `littlearc.auth` storage prefix. No AsyncStorage fallback exists.
- Generate and commit the provider's raw Drizzle schema with the exact
  `auth@1.6.23` CLI, then deterministically adapt only its table constructor to
  the accepted `littlearc` namespace. Commit a separately reviewed forward SQL
  migration.

The provider-generated account model includes a nullable `password`
compatibility column even while password authentication is disabled. LittleArc
does not expose, populate, or treat that column as an application contract.
Removing it would create unsupported drift from the pinned provider schema.

## Alternatives Considered

- A hosted identity service: rejected for the initial boundary because it adds
  another processor and does not match the accepted self-hosted architecture.
- Password authentication: rejected because it adds password storage and
  recovery burden without an MVP requirement.
- Process-memory sessions or rate limits: rejected because they do not survive
  restarts or coordinate across replicas.
- Household RLS on provider identity tables: rejected because authentication
  precedes household selection and global identity rows contain no household
  content.
- Hand-maintaining a schema that omits provider compatibility fields: rejected
  because it would silently drift from Better Auth's runtime adapter contract.
- Implicit account linking by matching email: rejected because provider email
  equivalence alone is insufficient proof of user intent.

## Consequences

Authentication policy, provider configuration, and session lifecycle have one
server boundary. PostgreSQL supports revocation and shared anti-abuse state, and
the mobile client avoids plaintext cookie persistence. Provider-schema upgrades
require exact regeneration, namespace adaptation, SQL review, and database
integration testing. Global identity tables require explicit grants instead of
household RLS. Live email, Apple, Google, deep-link, and physical-device
SecureStore behavior remain blocked until organization credentials and the
named pre-pilot device matrix are available.

## Validation

Focused tests cover OTP response uniformity, hashing through the real database
harness, expiry, attempt exhaustion, single use, rate limiting, origin rejection,
session creation/listing/revocation/sign-out, and recent authentication. The
Aiven harness applies both migrations to a temporary PostgreSQL database and
proves lifecycle behavior and identity-table grants. Mobile typechecking and
source review verify the SecureStore-only client boundary; physical-device
persistence is deliberately not claimed.

## Review Triggers

Review by 2026-10-20, or earlier when Better Auth is upgraded, a live social
provider or account-linking flow is enabled, session risk telemetry requires a
policy change, the auth tables need a separate schema/database, or a device test
finds SecureStore/deep-link lifecycle divergence.

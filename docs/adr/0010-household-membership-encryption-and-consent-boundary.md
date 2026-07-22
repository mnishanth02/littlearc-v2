# ADR-0010: Household Membership, Encryption, and Consent Boundary

> **Status:** Accepted
> **Date:** 2026-07-22
> **Owner:** Engineering
> **Review date:** 2026-10-22
> **Supersedes:** None
> **Superseded by:** None
> **Related documents:** [OFF-02 plan](../impl-plan/m2-offline-trust/off-02-household-parent-child-consent-and-audit-plan.md), [backend data model](../core/backend-data-model-and-database-schema.md), [ADR-0009](./0009-consumer-authentication-and-session-boundary.md)

---

## Context

OFF-02 connects a global Better Auth identity to tenant-owned household data.
The provider stores user IDs as strings, while LittleArc resource, membership,
audit, and synchronization IDs are UUIDv7. Parent and child profile fields are
restricted data that must be encrypted before PostgreSQL persistence. Child
creation also requires current notice/consent acceptance and an approved adult-
verification result, but the provider and retention policy remain blocked by
privacy/legal review.

The first onboarding transaction must create a usable aggregate without making
a client-provided household ID authoritative or leaving partial consent,
profile, key, audit, change, outbox, or idempotency state.

## Decision

- Keep Better Auth user IDs as provider-owned strings. Persist them only on
  identity/membership mappings; never coerce them into UUID actor columns.
- Use the active household-membership UUIDv7 as the actor ID for tenant context,
  capability checks, audit, change feed, and idempotency.
- Persist only `owner` and `caregiver` household roles. Staff remains a separate
  authorization context; co-parent remains product language for a caregiver
  capability bundle.
- Limit MVP to one active household membership per consumer identity. Revisit
  multi-household membership with M4 caregiver invitations.
- Derive identity from the OFF-01 server session. Establish identity, household,
  actor, and role with transaction-local PostgreSQL settings; client identifiers
  never grant authority.
- Create the owner household, membership, wrapped household key, encrypted
  parent profile, encrypted child profile, required consent, audit, change,
  outbox, and idempotency result in one transaction.
- Use AES-256-GCM with a versioned environment KEK, a random household key,
  per-object random DEKs, 96-bit nonces, and AAD bound to household ID, object
  ID/type, envelope format, and schema version. Store no plaintext profile or
  key in PostgreSQL, logs, analytics, or responses.
- Make consent and audit append-only to application and worker roles. Store only
  stable IDs, versions, result codes, and minimized metadata.
- Keep shared-environment onboarding disabled until an approved adult-
  verification adapter exists. A loopback-only adapter with one named synthetic
  assertion is allowed for automated and physical-device validation.

## Alternatives Considered

- Use the Better Auth user ID as the tenant ID: rejected because identity and
  tenant lifecycles differ and membership/capability checks would be bypassed.
- Change Better Auth IDs to UUIDv7: rejected because it would alter the accepted
  provider-owned OFF-01 schema and lifecycle for a domain concern.
- Store plaintext profile JSON behind RLS: rejected because RLS limits row
  access but does not reduce database/provider compromise impact.
- Create parent, consent, and child records through separate endpoints:
  rejected for the bounded first-owner flow because interruption could leave an
  ambiguous partial aggregate. A future resumable draft lifecycle needs its own
  reviewed states and cleanup guarantees.
- Persist adult-verification provider responses: rejected until privacy/legal
  selects the provider, data fields, retention, access, correction, and recovery
  policy.

## Consequences

The provider identity boundary stays stable, household actors remain typed
UUIDv7 resources, and RLS can require both membership and tenant context.
Envelope encryption adds key rotation and recovery obligations and prevents
server-side search within restricted payloads. The atomic endpoint is simple
and safe for the walking skeleton but is not yet a resumable production
onboarding experience. Real onboarding remains gated even though the synthetic
path is executable.

## Validation

- Crypto tests round-trip wrapped household keys and structured payloads and
  reject tampered ciphertext or changed AAD.
- Contract and route tests require the session, UUIDv7 idempotency key, exact
  notice versions, explicit country/time zone, and identifier-only response.
- The Aiven harness runs the migration and command as `littlearc_app`, checks
  exact replay, changed-payload conflict, forced rollback, cross-household RLS,
  append-only consent, key privileges, and plaintext canaries.
- The development-only mobile flow executes the same HTTP/database path with
  fixed synthetic values on the connected physical Android device.

## Review Triggers

Review by 2026-10-22, or earlier when adult-verification/provider policy is
approved, multi-household membership or invitations begin, key custody moves,
resumable onboarding is required, or encryption/recovery testing identifies a
different key hierarchy.

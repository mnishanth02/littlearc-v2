# OFF-02 Household, Parent, Child, Consent, and Audit

> **Status:** Complete
> **Started date:** 22 July 2026
> **Last updated:** 22 July 2026
> **Completion date:** 22 July 2026
> **Owner:** Engineering
> **Milestone:** M2
> **Work package:** `OFF-02`
> **Depends on:** Accepted Gate 1 and accepted `OFF-01` identity/session boundary
> **Dashboard:** [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
> **Inputs:** [roadmap](../roadmap.md),
> [backend data model](../../core/backend-data-model-and-database-schema.md),
> [mobile flow](../../core/mobile-application-flow.md), and
> [product plan](../../core/littlearc-complete-product-plan.md)

---

## Outcome

An authenticated synthetic user can become the owner of one household only
after the required notice, consent, and approved adult-verification gate, then
create an encrypted parent profile and one encrypted child profile with
append-only audit evidence and household-scoped RLS. This plan resolves the
schema and role decisions that OFF-01 must not guess.

## Scope

- Add user profile, household membership/capability, device, consent-event, and
  household-key metadata required for the first owner/child flow.
- Model `co-parent` as product language for an MVP caregiver capability bundle;
  persist only `owner` and `caregiver` household roles.
- Remove the silent server-side `US` household country default. Require an ISO
  country code at owner-household creation; the client may suggest `IN` from
  reviewed deployment/locale configuration but must submit an explicit value.
- Define and validate the encrypted-envelope V1 contract before parent or child
  payload migration.
- Require versioned notice/consent acceptance and an approved adult-verification
  result before child creation.
- Keep adult-verification provider fields and retention out of the schema until
  privacy/legal approval chooses the provider and evidence policy.
- Add transaction-local membership/capability authorization, RLS, composite
  same-tenant foreign keys, idempotency, audit, change-feed, and outbox behavior.
- Add one session-authenticated `POST /v1/households/onboarding` command. The
  command creates the household, owner membership, encrypted parent profile,
  required consent events, first encrypted child profile, audit rows, change
  rows, outbox row, and idempotency result atomically.
- Keep Better Auth's string user ID as the global identity reference. Use the
  owner membership UUIDv7 as the tenant actor ID in RLS, audit, change, and
  idempotency records; never coerce the provider ID into a UUID.

## Out Of Scope

- Authentication provider setup, OTP delivery, sessions, or account linking.
- Caregiver invitation UX and arbitrary custom roles; invitations arrive in M4.
- Real child/participant data or an unapproved adult-verification provider.
- Emergency card, local SQLCipher, synchronization, records, or files.
- Device enrollment behavior. `devices` is introduced as authorization-neutral
  metadata for `OFF-03`; creating a device row cannot grant household access.

## Dependencies

- OFF-01 supplies a verified global user ID and recent-authentication policy.
- Privacy/legal approval remains required before enabling adult verification or
  real child data. Synthetic tests use an injected approved-result fixture.
- Envelope encryption uses the accepted crypto boundary and versioned key
  metadata; no plaintext profile content enters PostgreSQL.
- Shared/staging/production onboarding remains disabled until an approved adult-
  verification adapter and versioned KEK are configured. A local-only synthetic
  adapter may approve the named test assertion for automated and device proof.

## Module Status

| Module | Status | Notes |
| --- | --- | --- |
| Shared role and country decisions | Completed | Conservative role bundle and explicit country input accepted for planning. |
| Plan review and data/encryption contract | Completed | Envelope V1, key hierarchy, provider-user-to-membership mapping, atomicity, and evidence boundaries finalized. |
| Migration and RLS | Completed | Same-tenant constraints, policies, append-only grants, identity bootstrap, and real PostgreSQL isolation pass. |
| Owner onboarding command | Completed | Atomic consent, verification, encryption, household, membership, child, audit, change, outbox, and replay are implemented. |
| Mobile onboarding UI | Completed | Development-only synthetic Pixel 8 UI/HTTP/PostgreSQL flow and bounded log review passed. |
| Real-provider and real-data evidence | Blocked | Requires named privacy/legal/provider gates. |

## Implementation Plan

1. Accept ADR-0010 for the provider-user/membership split, one-active-household
   MVP cardinality, session-derived identity, capability enforcement, envelope
   key hierarchy, and local-only verification harness.
2. Activate `@littlearc/crypto` with an exact `EncryptedEnvelopeV1` validator,
   AES-256-GCM household-key wrapping and per-object encryption, immutable AAD
   context, decryption tests, and no key/plaintext logging or persistence.
3. Add the reviewed `0003_off_02_household_consent_audit.sql` migration and
   matching Drizzle schema for profiles, memberships, capabilities, devices,
   consent events, and household keys. Remove the country default; add exact
   envelope checks, composite tenant foreign keys, RLS, identity bootstrap,
   and append-only consent/audit enforcement.
4. Extend domain/contracts with persisted `owner`/`caregiver` roles, explicit
   country/time-zone and consent validation, a typed onboarding request and
   minimal identifier-only response, and a documented session-cookie security
   boundary.
5. Implement `POST /v1/households/onboarding` as an atomic command. Authenticate
   through the OFF-01 session resolver, obtain an injected adult-verification
   decision, encrypt parent/child payloads, reserve/replay the idempotency key,
   persist the complete aggregate and operational evidence, and return no
   decrypted profile fields.
6. Add adversarial tests for missing/stale identity, rejected verification,
   missing/wrong consent versions, invalid country/time zone, replay mismatch,
   rollback, append-only evidence, caregiver denial, and cross-household RLS.
7. Add a development-only Android validation route containing only fixed,
   visibly synthetic values. Drive privacy acknowledgement, synthetic adult
   verification, consent, parent/child review, submission, retry, and completion
   through the real HTTP contract and a temporary PostgreSQL database.
8. Run focused checks first, then Aiven PostgreSQL integration, the root suite,
   builds, validation, generated-output drift, clean-checkout proof, and the
   connected physical-Android flow. Record what remains provider/real-data gated.

## Acceptance Criteria

- Household creation requires a verified OFF-01 session identity, explicit ISO
  country, valid IANA time zone, exact required notice/consent versions, and an
  approved result from the injected adult-verification port.
- One auth user can hold one active household membership in MVP. The database
  persists only `owner` and `caregiver`; co-parent remains UI language for a
  caregiver capability bundle, and staff is not a household role.
- Parent and child profile JSON never enters PostgreSQL or observability in
  plaintext. Each envelope uses a per-object DEK, an active household key,
  AES-256-GCM, random 96-bit nonces, and AAD bound to household, object ID, type,
  format, and schema version.
- The onboarding transaction is all-or-nothing and idempotent. An exact replay
  returns the prior response; a changed payload with the same key fails; a
  rejected verification or database error leaves no household, profile, child,
  consent, audit, change, outbox, key, or idempotency row.
- Tenant reads/writes require transaction-local identity, household, actor, and
  role context. Client household IDs do not create authority, and composite
  foreign keys prevent same-database cross-household references.
- Consent and audit rows are append-only to application/worker roles. Audit
  metadata contains only stable types, IDs, revisions, request IDs, results,
  and safe failure codes—never payload values, tokens, keys, or provider data.
- The API response contains only household, membership, parent-profile, child,
  and consent identifiers plus replay state; it never returns decrypted names,
  dates, verification assertions, or key material.
- The physical Android proof uses a temporary synthetic PostgreSQL database and
  fixed synthetic labels, verifies the complete UI/HTTP/database path, and is
  not reported as real-provider, real-data, physical-iOS, or Gate 2 evidence.

## Validation

- Package/domain/contract/database/API/mobile focused tests and typechecks.
- Real PostgreSQL migration, RLS, cross-household, consent, and rollback cases.
- Synthetic physical-Android onboarding over the real HTTP contract and a
  temporary PostgreSQL database, including completion semantics and logcat
  leakage/fatal-error review.
- Generated-output drift, root tests/build/`pnpm validate`, `git diff --check`,
  documentation checks, and clean-checkout proof under Node 24.18.0.

## Evidence

The live [OFF-02 implementation evidence](./off-02-implementation-evidence.md)
records the automated and physical-device acceptance boundary. The finalized
plan authorizes only synthetic implementation and validation; it does not
authorize real provider evidence, real child data, invitations, or later M2
packages.

## Risks And Blockers

| Risk or blocker | Control | Resolution trigger |
| --- | --- | --- |
| Product co-parent language creates a new unchecked role | Map it to caregiver capabilities; keep owner/caregiver persistence. | Contract/ADR review proves a third role is required. |
| US default leaks into India-first onboarding | Remove DB default and require explicit input. | OFF-02 migration and API validation pass. |
| Verification guesses become sensitive schema | Inject synthetic decision only; add no provider evidence fields. | Privacy/legal selects provider, fields, retention, and recovery. |
| Auth user becomes a tenant identifier | Require active membership and transaction-local household context. | RLS/BOLA integration suite passes. |
| Better Auth string IDs are coerced into UUID actor columns | Persist provider user IDs as text references and use membership UUIDv7 IDs as tenant actors. | Schema and real-PostgreSQL tests prove the mapping. |
| A retry creates a second household or partial aggregate | One active membership per user plus fingerprinted idempotency and one transaction. | Replay and forced-rollback integration cases pass. |
| Encryption shape exists without cryptographic binding | Encrypt/decrypt/tamper tests cover per-object DEKs, household wrapping, and immutable AAD. | Crypto tests and database envelope checks pass. |

## Decisions

- Persist household roles as `owner` and `caregiver`; render co-parent as a
  caregiver relationship/capability preset until a later ADR changes it.
- Require explicit household country input and remove the `US` database default.
- Store no adult-verification document or provider payload before specialist
  approval; synthetic tests use a non-persisted result port.
- Consent and audit evidence is append-only and cannot be ordinary-cascade
  deleted.
- Use one atomic onboarding endpoint for the bounded OFF-02 walking skeleton;
  later resumable onboarding may introduce drafts only with a new reviewed
  lifecycle and equivalent no-partial-child guarantees.
- One active household per auth user is the MVP cardinality. Caregiver
  invitations and multi-household membership are reopened in M4.
- A development-only session/verification harness is acceptable for synthetic
  device proof only when it binds to loopback, uses a temporary database, and
  cannot be selected by staging or production configuration.

## Follow-Up

- Plan and implement OFF-03 in its own reviewed pass using the accepted OFF-02
  household and device-metadata boundary.
- Reopen provider evidence/retention fields at the pre-real-data privacy/legal
  gate.

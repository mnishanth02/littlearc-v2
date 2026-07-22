# OFF-02 Household, Parent, Child, Consent, and Audit

> **Status:** Accepted
> **Started date:** N/A
> **Last updated:** 20 July 2026
> **Completion date:** N/A
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

## Out Of Scope

- Authentication provider setup, OTP delivery, sessions, or account linking.
- Caregiver invitation UX and arbitrary custom roles; invitations arrive in M4.
- Real child/participant data or an unapproved adult-verification provider.
- Emergency card, local SQLCipher, synchronization, records, or files.

## Dependencies

- OFF-01 supplies a verified global user ID and recent-authentication policy.
- Privacy/legal approval remains required before enabling adult verification or
  real child data. Synthetic tests use an injected approved-result fixture.
- Envelope encryption uses the accepted crypto boundary and versioned key
  metadata; no plaintext profile content enters PostgreSQL.

## Module Status

| Module | Status | Notes |
| --- | --- | --- |
| Shared role and country decisions | Completed | Conservative role bundle and explicit country input accepted for planning. |
| Data/encryption contract | Planned | Finalize envelope V1 and identity-to-membership cardinality. |
| Migration and RLS | Planned | Add same-tenant constraints, policies, and grants. |
| Owner onboarding command | Planned | Consent, verification gate, profile, household, membership, child, audit. |
| Mobile onboarding UI | Planned | Accessible loading/error/retry states with synthetic content. |
| Real-provider and real-data evidence | Blocked | Requires named privacy/legal/provider gates. |

## Implementation Plan

1. Accept an ADR for household membership/capability authorization and encrypted
   profile boundary.
2. Version the encrypted-envelope contract and add schema/RLS migration with
   composite same-tenant constraints.
3. Implement atomic, idempotent owner-household activation after versioned
   notice/consent and an injected approved adult-verification result.
4. Add capability policy and adversarial owner/caregiver/cross-household tests.
5. Add accessible onboarding screens and failure recovery with synthetic data.
6. Run real PostgreSQL RLS/transaction tests, root validation, device checks,
   and record evidence boundaries.

## Validation

- Package/domain/contract/database/API/mobile focused tests and typechecks.
- Real PostgreSQL migration, RLS, cross-household, consent, and rollback cases.
- Synthetic device onboarding accessibility on the accepted package matrix.
- Root `pnpm validate`, `git diff --check`, and clean-checkout proof.

## Evidence

Create OFF-02 evidence only during its implementation pass. This companion plan
is accepted solely to unblock OFF-01's global identity boundary; it does not
authorize household/child code or real data in OFF-01.

## Risks And Blockers

| Risk or blocker | Control | Resolution trigger |
| --- | --- | --- |
| Product co-parent language creates a new unchecked role | Map it to caregiver capabilities; keep owner/caregiver persistence. | Contract/ADR review proves a third role is required. |
| US default leaks into India-first onboarding | Remove DB default and require explicit input. | OFF-02 migration and API validation pass. |
| Verification guesses become sensitive schema | Inject synthetic decision only; add no provider evidence fields. | Privacy/legal selects provider, fields, retention, and recovery. |
| Auth user becomes a tenant identifier | Require active membership and transaction-local household context. | RLS/BOLA integration suite passes. |

## Decisions

- Persist household roles as `owner` and `caregiver`; render co-parent as a
  caregiver relationship/capability preset until a later ADR changes it.
- Require explicit household country input and remove the `US` database default.
- Store no adult-verification document or provider payload before specialist
  approval; synthetic tests use a non-persisted result port.
- Consent and audit evidence is append-only and cannot be ordinary-cascade
  deleted.

## Follow-Up

- Implement OFF-02 only in its own reviewed pass after OFF-01 evidence is
  accepted.
- Reopen provider evidence/retention fields at the pre-real-data privacy/legal
  gate.

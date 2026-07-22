# OFF-02 Implementation Evidence

> **Status:** Accepted
> **Last updated:** 22 July 2026
> **Owner:** Engineering
> **Work package:** `OFF-02`
> **Plan:** [OFF-02 Household, Parent, Child, Consent, and Audit](./off-02-household-parent-child-consent-and-audit-plan.md)
> **Decision:** [ADR-0010](../../adr/0010-household-membership-encryption-and-consent-boundary.md)

---

## 1. Implemented Outcome

LittleArc now has a synthetic-only owner-onboarding walking skeleton. An
authenticated user can acknowledge the exact notices, pass an injected adult-
verification decision, and atomically create one household, owner membership,
encrypted parent profile, encrypted child profile, append-only consent and
audit evidence, change-feed entries, an outbox event, and an idempotency result.

The implementation does not enable real adult verification or real parent or
child data. Shared, staging, and production configuration reject the synthetic
verification adapter.

## 2. Implemented Boundary

- `@littlearc/domain` owns the owner/caregiver role policy, explicit country and
  time-zone validation, exact notice versions, and UUIDv7 identifier primitive.
- `@littlearc/crypto` owns the versioned encrypted-envelope contract,
  AES-256-GCM household-key wrapping, per-object data-encryption keys, random
  96-bit nonces, immutable additional authenticated data, and key zeroing.
- `@littlearc/database` owns the membership, profile, device, consent,
  capability, key, audit, change, outbox, and idempotency persistence boundary.
- `POST /v1/households/onboarding` derives the global user from the OFF-01
  session boundary, invokes the injected verification port, encrypts before
  persistence, and returns identifiers only.
- The mobile application exposes a development-only, fixed-synthetic-data flow
  for privacy acknowledgement, verification, consent, review, submission,
  retry, and completion. It is excluded from production navigation.

## 3. Schema, Encryption, and Authorization Review

Migration `0003_off_02_household_consent_audit.sql` removes the household
country default and requires explicit input. It introduces user profiles,
household memberships, membership capabilities, devices, consent events, and
household keys; tightens audit metadata; and adds same-household composite
foreign keys and row-level security.

Better Auth user IDs remain global strings. Household membership UUIDv7 IDs are
the tenant actors used by RLS, audit, change, outbox, and idempotency records.
One active household membership per user is enforced for the MVP. Application
and worker roles cannot update or delete consent or audit evidence, and key
material is not readable through ordinary application queries.

Parent and child JSON is encrypted before entering PostgreSQL. Envelope V1
binds household ID, object ID, object type, format, and schema version as
additional authenticated data. The database stores ciphertext, wrapped keys,
nonces, algorithms, and key versions; it does not store plaintext profile JSON
or adult-verification provider evidence.

## 4. PostgreSQL Integration Evidence

`pnpm test:database:household` passed against the configured Aiven PostgreSQL
development service. The harness created a fresh temporary database, applied
all three reviewed migrations, and proved:

1. atomic aggregate creation and exact idempotent replay;
2. rejection of a changed payload under the same idempotency key;
3. forced failure rollback without a partial household or membership;
4. two-household RLS isolation under the `littlearc_app` role;
5. append-only consent enforcement and restricted household-key access;
6. UUIDv7 membership actors while Better Auth user IDs remain strings; and
7. absence of the fixed parent and child plaintext canaries from persisted
   encrypted envelopes.

The harness drops its temporary database in a `finally` block, including after
the bounded device server receives `SIGINT` or `SIGTERM`.

## 5. Validation Results

All commands use Node.js 24.18.0 and pnpm 11.14.0.

| Validation | Result |
| --- | --- |
| `pnpm --filter @littlearc/domain test` | Passed; 14 policy, onboarding, and UUIDv7 tests. |
| `pnpm --filter @littlearc/crypto test` | Passed; 3 round-trip, tamper, AAD, and exact-shape tests. |
| `pnpm --filter @littlearc/database test` | Passed; 21 migration, schema, tenant, and persistence tests. |
| `pnpm --filter @littlearc/contracts test` | Passed; 11 contract and generated-OpenAPI tests. |
| `pnpm --filter @littlearc/auth test` | Passed; 10 auth and session-identity tests. |
| `pnpm --filter @littlearc/api test` | Passed; 12 route, configuration, failure, and privacy tests. |
| Focused API/database/auth/mobile typechecks | Passed. |
| `pnpm test:database:household` | Passed; atomicity, replay, rollback, RLS, append-only, key-access, and plaintext-canary cases. |
| Physical Android owner-onboarding flow | Passed on Pixel 8, Android 17/API 37; the accessible privacy, verification, consent, review, HTTP submission, and completion states reached the real temporary PostgreSQL harness. |
| `pnpm check:generated` twice | Passed; three registered generators were idempotent and drift-free. |
| `pnpm test` | Passed; 126 tooling, unit, and contract tests across the workspace. |
| `pnpm build` | Passed; package/server/staff builds and Android/iOS Hermes exports completed. |
| `pnpm --filter @littlearc/mobile run doctor` | Passed all 20 Expo project checks. |
| `pnpm validate` | Passed; toolchain, workspace, supply-chain, generated output, formatting, documentation, and 13-package typechecks passed. |
| `git diff --check` | Passed. |
| `./tooling/validate-clean-checkout.sh` | Passed from a 328-file source-only snapshot with a frozen install and uncached 13-package typecheck graph. |

## 6. Evidence Boundaries

The physical run used the installed LittleArc debug development client,
MCP-enabled Expo Metro server, ADB reverse tunnels to loopback API and Metro,
and a fresh temporary PostgreSQL database. UIAutomator observed every named
action and the final `OFF-02 physical Android validation passed` accessibility
state. The API independently reported the physical-device HTTP/database path
as passed, and the final screenshot was visually reviewed.

The LittleArc process remained alive. The bounded post-run logcat scan found
zero fatal/React Native runtime matches and zero matches for the synthetic
parent/child/date, verification assertion, synthetic session header, key-secret
name, or temporary-database canaries. Metro and the API were stopped, reverse
tunnels were removed, and a provider query confirmed zero remaining OFF-02
temporary databases.

This dossier does not claim:

- a live or approved adult-verification provider, provider evidence retention,
  document verification, or recovery behavior;
- real parent, child, participant, health, consent, or identity-document data;
- caregiver invitations, multiple active household memberships, arbitrary
  custom roles, or staff-as-household-role behavior;
- physical iOS, signed-store, install/upgrade, offline SQLCipher, synchronization,
  emergency-card, or Gate 2 acceptance; or
- staging or production enablement of the synthetic session or verification
  adapters.

## 7. Completion Decision

**Decision: COMPLETE.** OFF-02 meets its synthetic implementation boundary,
including encryption, atomicity, tenant isolation, append-only evidence,
automated repository gates, real PostgreSQL integration, and the bounded Pixel
8 UI/HTTP/database proof. OFF-03 planning is next; live verification providers,
real data, physical iOS, and Gate 2 remain outside this acceptance.

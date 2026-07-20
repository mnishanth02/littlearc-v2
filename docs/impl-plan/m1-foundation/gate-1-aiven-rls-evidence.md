# Gate 1 Aiven PostgreSQL RLS Evidence

> **Gate:** Gate 1 — Foundation Is Reproducible
> **Status:** Complete
> **Evidence date:** 20 July 2026
> **Last updated:** 20 July 2026
> **Owner:** Engineering
> **Related decision:** [ADR-0005](../../adr/0005-postgresql-rls-migrations-and-pg-boss.md)

---

## 1. Acceptance Scope

This evidence closes the remaining Gate 1 criterion that requires a seeded
cross-household query to be blocked by PostgreSQL row-level security. It uses
the founder-selected Aiven PostgreSQL service for local development and only
synthetic identifiers and encrypted-payload placeholders.

The repeatable command is:

```sh
pnpm test:database:rls
```

The command loads the ignored mode-`0600` `.env.aiven` file without printing
the connection string. It creates an isolated temporary database, applies the
reviewed `0001_fnd_05_database_foundation` migration, runs the assertions, and
then removes the database, temporary login membership, and any foundation roles
that did not exist before the run.

## 2. Provider and Migration Evidence

| Evidence | Result |
| --- | --- |
| Provider | Aiven PostgreSQL development service |
| Server reported version | PostgreSQL 17.10 |
| Transport | TLS required through libpq-compatible `sslmode=require` semantics |
| Migration | `0001_fnd_05_database_foundation` applied unchanged to a fresh temporary database |
| Migration embedded checksum | `ed4ad8fd41cd96a1ef1862bd462b5a25f9b07b7cce7ee73fb7c720d40a579f82` |
| Fixtures | Two synthetic households and one synthetic child per household |
| Execution role | `littlearc_app` with `NOLOGIN`, `NOINHERIT`, `NOSUPERUSER`, and no `BYPASSRLS` |
| Cleanup | Temporary database and test-only cluster changes removed successfully |

The accepted architecture target remains PostgreSQL 18. The selected Aiven
development service currently reports 17.10, so this pass proves the Gate 1 RLS
behavior but does not claim PostgreSQL 18-specific local compatibility. Upgrade
or revalidate the local service before relying on PostgreSQL 18-only behavior.

## 3. Isolation Results

| Assertion | Result |
| --- | --- |
| Application role without tenant context reads tenant rows | Pass; zero rows returned |
| Household A reads its own child | Pass; only Child A returned |
| Household A runs an unfiltered child query | Pass; Child B was absent |
| Household A selects Child B by exact identifier | Pass; zero rows returned |
| Household A selects Household B | Pass; zero rows returned |
| Household A updates Child B | Pass; zero rows changed |
| Household A inserts a child for Household B | Pass; rejected with SQLSTATE `42501` |
| Household B reads its own seeded child | Pass; only Child B returned |

The `SELECT` checks demonstrate PostgreSQL's expected RLS filtering behavior:
unauthorized rows are invisible rather than necessarily producing an error. The
cross-household `INSERT` demonstrates an explicit policy rejection.

## 4. Repository Validation

All commands used Node.js 24.18.0 and pnpm 11.14.0.

| Command | Result |
| --- | --- |
| `pnpm test:database:rls` | Pass against Aiven PostgreSQL 17.10 |
| `pnpm --filter @littlearc/database typecheck` | Pass, including the integration harness |
| `pnpm --filter @littlearc/database test` | Pass; 12 focused tests |
| `pnpm check:generated` | Pass; two registered generated artifacts |
| `pnpm install --frozen-lockfile` | Pass |
| `pnpm validate` | Pass |
| `pnpm test` | Pass |
| `pnpm build` | Pass, including Android and iOS release exports |
| `pnpm check:docs` | Pass |
| `pnpm check:format` | Pass; 150 Biome files and 74 Markdown files |
| `./tooling/validate-clean-checkout.sh` | Pass; 280-file source-only snapshot with frozen install and full validation |

The ignored Aiven credential is intentionally absent from clean-checkout
validation, so the provider test remains an explicit separate command.

## 5. Evidence Boundaries

This evidence proves the implemented foundation migration and
`littlearc_app` cross-household RLS behavior on real PostgreSQL. It does not
claim:

- PostgreSQL 18-specific local-provider compatibility;
- API authentication, household membership, BOLA, or session enforcement;
- worker or operations-role product behavior;
- transaction, idempotency, sync, or `pg-boss` integration beyond the Gate 1
  isolation case;
- production configuration, production data, or permission to use real child
  or participant data; or
- CA-verified `sslmode=verify-full` until the Aiven service CA is configured
  locally.

## 6. Gate Decision

**Decision: PASS for the remaining Gate 1 RLS criterion.** Together with the
previously accepted foundation-package, staging, mobile-device, accessibility,
observability, and documentation evidence, this completes M1 and makes M2
work-package planning ready. `OFF-01` and `OFF-02` still require standalone
accepted plans before implementation begins.

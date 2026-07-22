import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { databaseMigrations } from "./metadata.js";

const foundation = databaseMigrations()[0];
if (!foundation) {
  throw new Error("Expected the FND-05 foundation migration to be registered.");
}
const generatedSql = readFileSync(join("migrations", foundation.filename), "utf8");
const auth = databaseMigrations()[1];
if (!auth) {
  throw new Error("Expected the OFF-01 auth migration to be registered.");
}
const generatedAuthSql = readFileSync(join("migrations", auth.filename), "utf8");

describe("database migration foundation", () => {
  it("keeps the generated migration artifact in sync with the reviewed source", () => {
    expect(generatedSql).toBe(`${foundation.sql}\n`);
  });

  it("declares separate roles and explicit tenant context settings", () => {
    expect(foundation.sql).toContain("create role littlearc_migration");
    expect(foundation.sql).toContain("create role littlearc_migration noinherit");
    expect(foundation.sql).not.toContain("create role littlearc_migration login");
    expect(foundation.sql).toContain("create role littlearc_app");
    expect(foundation.sql).toContain("create role littlearc_worker");
    expect(foundation.sql).toContain("create role littlearc_ops_readonly");
    expect(foundation.sql).toContain("current_setting('littlearc.current_household_id', true)");
    expect(foundation.sql).toContain("current_setting('littlearc.current_actor_id', true)");
    expect(foundation.sql).toContain("current_setting('littlearc.current_actor_role', true)");
  });

  it("grants current and future objects without broadening worker table access", () => {
    expect(foundation.sql).toContain(
      "alter default privileges for role littlearc_migration in schema littlearc",
    );
    expect(foundation.sql).toContain("grant select, insert, update on tables to littlearc_app");
    expect(foundation.sql).toContain("grant select on tables to littlearc_ops_readonly");
    expect(foundation.sql).toContain(
      "grant usage, select on sequences to littlearc_app, littlearc_worker",
    );
    expect(foundation.sql).not.toContain(
      "grant select, insert, update on tables to littlearc_worker",
    );
  });

  it("enables and forces RLS on every tenant-scoped foundation table", () => {
    for (const table of [
      "households",
      "children",
      "audit_events",
      "idempotency_results",
      "change_events",
      "outbox_events",
    ]) {
      expect(foundation.sql).toContain(`alter table littlearc.${table} enable row level security;`);
      expect(foundation.sql).toContain(`alter table littlearc.${table} force row level security;`);
      expect(foundation.sql).toContain(`create policy ${table}_tenant_isolation`);
    }
  });

  it("creates audit, idempotency, change feed, outbox, and migration bookkeeping", () => {
    expect(foundation.sql).toContain("create table if not exists littlearc.audit_events");
    expect(foundation.sql).toContain("create table if not exists littlearc.idempotency_results");
    expect(foundation.sql).toContain("constraint idempotency_results_pk primary key");
    expect(foundation.sql).toContain("create table if not exists littlearc.change_events");
    expect(foundation.sql).toContain("sequence bigserial primary key");
    expect(foundation.sql).toContain("create table if not exists littlearc.outbox_events");
    expect(foundation.sql).toContain("create table if not exists littlearc.schema_migrations");
    expect(foundation.sql).not.toContain("__CHECKSUM_SHA256__");
  });
});

describe("OFF-01 consumer auth migration", () => {
  it("keeps the generated migration artifact in sync with reviewed source", () => {
    expect(generatedAuthSql).toBe(`${auth.sql}\n`);
  });

  it("creates exactly the pinned Better Auth storage models", () => {
    for (const table of [
      "auth_user",
      "auth_session",
      "auth_account",
      "auth_verification",
      "auth_rate_limit",
    ]) {
      expect(auth.sql).toContain(`create table if not exists littlearc.${table}`);
    }
    expect(auth.sql).toContain("value text not null");
    expect(auth.sql).toContain("last_request bigint not null");
    expect(auth.sql).not.toContain("household_id");
    expect(auth.sql).not.toContain("child_id");
  });

  it("gives the API lifecycle access without exposing identity rows to worker or ops roles", () => {
    expect(auth.sql).toContain("grant select, insert, update, delete on");
    expect(auth.sql).toContain("to littlearc_app");
    expect(auth.sql).toContain("from littlearc_worker, littlearc_ops_readonly");
  });
});

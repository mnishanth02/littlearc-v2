import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { databaseMigrations } from "./metadata.js";

const foundation = databaseMigrations()[0];
if (!foundation) {
  throw new Error("Expected the FND-05 foundation migration to be registered.");
}
const generatedSql = readFileSync(join("migrations", foundation.filename), "utf8");

describe("database migration foundation", () => {
  it("keeps the generated migration artifact in sync with the reviewed source", () => {
    expect(generatedSql).toBe(`${foundation.sql}\n`);
  });

  it("declares separate roles and explicit tenant context settings", () => {
    expect(foundation.sql).toContain("create role littlearc_migration");
    expect(foundation.sql).toContain("create role littlearc_app");
    expect(foundation.sql).toContain("create role littlearc_worker");
    expect(foundation.sql).toContain("create role littlearc_ops_readonly");
    expect(foundation.sql).toContain("current_setting('littlearc.current_household_id', true)");
    expect(foundation.sql).toContain("current_setting('littlearc.current_actor_id', true)");
    expect(foundation.sql).toContain("current_setting('littlearc.current_actor_role', true)");
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

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
const household = databaseMigrations()[2];
if (!household) {
  throw new Error("Expected the OFF-02 household migration to be registered.");
}
const generatedHouseholdSql = readFileSync(join("migrations", household.filename), "utf8");
const emergencyCard = databaseMigrations()[3];
if (!emergencyCard) {
  throw new Error("Expected the OFF-05 emergency-card migration to be registered.");
}
const generatedEmergencyCardSql = readFileSync(join("migrations", emergencyCard.filename), "utf8");
const recordFoundation = databaseMigrations()[4];
if (!recordFoundation) {
  throw new Error("Expected the VLT-01 record-foundation migration to be registered.");
}
const generatedRecordFoundationSql = readFileSync(
  join("migrations", recordFoundation.filename),
  "utf8",
);
const fileUpload = databaseMigrations()[5];
if (!fileUpload) {
  throw new Error("Expected the VLT-04 file-upload migration to be registered.");
}
const generatedFileUploadSql = readFileSync(join("migrations", fileUpload.filename), "utf8");

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

describe("VLT-04 file upload migration", () => {
  it("keeps the reviewed source and generated artifact synchronized", () => {
    expect(generatedFileUploadSql).toBe(`${fileUpload.sql}\n`);
  });

  it("keeps ciphertext tenant-scoped and worker cleanup least-authority", () => {
    for (const table of ["upload_sessions", "file_objects"]) {
      expect(fileUpload.sql).toContain(`alter table littlearc.${table} enable row level security;`);
      expect(fileUpload.sql).toContain(`alter table littlearc.${table} force row level security;`);
    }
    expect(fileUpload.sql).toContain("claim_expired_upload_sessions");
    expect(fileUpload.sql).toContain("finish_expired_upload_session");
    expect(fileUpload.sql).toContain("security definer");
    expect(fileUpload.sql).toContain(
      "revoke all on littlearc.upload_sessions, littlearc.file_objects",
    );
    expect(fileUpload.sql).toContain("from littlearc_worker, littlearc_ops_readonly");
    expect(fileUpload.sql).not.toContain(
      "grant select, insert, update, delete on littlearc.file_objects to littlearc_worker",
    );
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

describe("OFF-02 household migration", () => {
  it("keeps the reviewed source and generated artifact synchronized", () => {
    expect(generatedHouseholdSql).toBe(`${household.sql}\n`);
  });

  it("adds identity, membership, consent, key, and encrypted-profile boundaries", () => {
    for (const table of [
      "household_memberships",
      "user_profiles",
      "membership_capabilities",
      "devices",
      "consent_events",
      "household_keys",
    ]) {
      expect(household.sql).toContain(`create table littlearc.${table}`);
      expect(household.sql).toContain(`alter table littlearc.${table} enable row level security`);
    }
    expect(household.sql).toContain("alter column default_country_code drop default");
    expect(household.sql).toContain("household_memberships_one_active_user_idx");
    expect(household.sql).toContain("current_identity_user_id()");
    expect(household.sql).toContain("children_envelope_check");
  });

  it("keeps consent and audit append-only and keys unavailable to worker and ops", () => {
    expect(household.sql).toContain(
      "revoke update, delete on littlearc.consent_events, littlearc.audit_events",
    );
    expect(household.sql).toContain(
      "revoke all on littlearc.household_keys from littlearc_worker, littlearc_ops_readonly",
    );
  });
});

describe("OFF-05 emergency-card migration", () => {
  it("keeps the reviewed source and generated artifact synchronized", () => {
    expect(generatedEmergencyCardSql).toBe(`${emergencyCard.sql}\n`);
  });

  it("enforces dedicated encrypted immutable version history under RLS", () => {
    expect(emergencyCard.sql).toContain("create table littlearc.emergency_cards");
    expect(emergencyCard.sql).toContain("create table littlearc.emergency_card_versions");
    expect(emergencyCard.sql).toContain("emergency_cards_one_active_child_idx");
    expect(emergencyCard.sql).toContain("emergency_cards_current_version_fk");
    expect(emergencyCard.sql).toContain("emergency_card_versions_envelope_check");
    expect(emergencyCard.sql).toContain("emergency_card_versions_immutable");
    expect(emergencyCard.sql).toContain(
      "alter table littlearc.emergency_card_versions force row level security",
    );
    expect(emergencyCard.sql).toContain(
      "revoke update, delete on littlearc.emergency_card_versions",
    );
    expect(emergencyCard.sql).toContain("revoke all on littlearc.emergency_card_versions");
  });
});

describe("VLT-01 record-foundation migration", () => {
  it("keeps the reviewed source and generated artifact synchronized", () => {
    expect(generatedRecordFoundationSql).toBe(`${recordFoundation.sql}\n`);
  });

  it("enforces encrypted immutable versions, separate suggestions, and Timeline RLS", () => {
    for (const table of ["records", "record_versions", "record_suggestions", "timeline_entries"]) {
      expect(recordFoundation.sql).toContain(`create table littlearc.${table}`);
      expect(recordFoundation.sql).toContain(
        `alter table littlearc.${table} force row level security`,
      );
      expect(recordFoundation.sql).toContain(`create policy ${table}_tenant_isolation`);
    }
    expect(recordFoundation.sql).toContain("records_current_version_fk");
    expect(recordFoundation.sql).toContain("record_versions_immutable");
    expect(recordFoundation.sql).toContain("record_versions_envelope_check");
    expect(recordFoundation.sql).toContain("record_suggestions_suggestion_envelope_check");
    expect(recordFoundation.sql).toContain("timeline_entries_one_active_record_idx");
    expect(recordFoundation.sql).toContain(
      "revoke all on littlearc.records, littlearc.record_versions",
    );
  });
});

import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  auditEvents,
  auth_account,
  auth_rate_limit,
  auth_session,
  auth_user,
  auth_verification,
  changeEvents,
  children,
  consentEvents,
  devices,
  householdKeys,
  householdMemberships,
  households,
  idempotencyResults,
  littlearcSchemaName,
  outboxEvents,
  schemaMigrations,
  userProfiles,
} from "./schema/index.js";

describe("database schema", () => {
  it("exports the FND-05 foundation tables in the LittleArc schema", () => {
    expect(littlearcSchemaName).toBe("littlearc");
    expect(
      [
        households,
        schemaMigrations,
        children,
        auditEvents,
        idempotencyResults,
        changeEvents,
        outboxEvents,
      ].map(getTableName),
    ).toEqual([
      "households",
      "schema_migrations",
      "children",
      "audit_events",
      "idempotency_results",
      "change_events",
      "outbox_events",
    ]);
  });

  it("keeps the children revision constraint aligned with the reviewed migration", () => {
    expect(getTableConfig(children).checks.map((constraint) => constraint.name)).toContain(
      "children_revision_check",
    );
  });

  it("keeps provider-owned auth tables global and namespaced without tenant content", () => {
    const authTables = [auth_user, auth_account, auth_session, auth_verification, auth_rate_limit];
    expect(authTables.map(getTableName)).toEqual([
      "auth_user",
      "auth_account",
      "auth_session",
      "auth_verification",
      "auth_rate_limit",
    ]);
    for (const table of authTables) {
      const config = getTableConfig(table);
      expect(config.schema).toBe("littlearc");
      expect(config.columns.map((column) => column.name)).not.toContain("household_id");
      expect(config.columns.map((column) => column.name)).not.toContain("child_id");
    }
  });

  it("exports the OFF-02 household boundary and removes the silent country default", () => {
    expect(
      [householdMemberships, userProfiles, devices, consentEvents, householdKeys].map(getTableName),
    ).toEqual([
      "household_memberships",
      "user_profiles",
      "devices",
      "consent_events",
      "household_keys",
    ]);
    const country = getTableConfig(households).columns.find(
      (column) => column.name === "default_country_code",
    );
    expect(country?.hasDefault).toBe(false);
  });

  it("models same-household membership and child references as composite keys", () => {
    expect(getTableConfig(children).foreignKeys.map((key) => key.getName())).toEqual(
      expect.arrayContaining([
        "children_created_by_membership_fk",
        "children_updated_by_membership_fk",
      ]),
    );
    expect(getTableConfig(consentEvents).foreignKeys.map((key) => key.getName())).toEqual(
      expect.arrayContaining(["consent_events_actor_fk", "consent_events_child_fk"]),
    );
  });
});

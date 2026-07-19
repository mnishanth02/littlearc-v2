import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  auditEvents,
  changeEvents,
  children,
  households,
  idempotencyResults,
  littlearcSchemaName,
  outboxEvents,
  schemaMigrations,
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
});

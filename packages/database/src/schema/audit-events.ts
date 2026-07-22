import type { AuditAction, HouseholdRole } from "@littlearc/domain";
import { foreignKey, index, text } from "drizzle-orm/pg-core";
import { createdAtColumn, jsonObjectColumn, uuidV7Column } from "./_columns.js";
import { householdMemberships } from "./household-memberships.js";
import { households } from "./households.js";
import { littlearcSchema } from "./schema.js";

export const auditEvents = littlearcSchema.table(
  "audit_events",
  {
    id: uuidV7Column("id").primaryKey(),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    actorId: uuidV7Column("actor_id").notNull(),
    actorRole: text("actor_role").$type<HouseholdRole>().notNull(),
    action: text("action").$type<AuditAction>().notNull(),
    purposeCode: text("purpose_code"),
    targetType: text("target_type").notNull(),
    targetId: uuidV7Column("target_id").notNull(),
    requestId: uuidV7Column("request_id").notNull(),
    result: text("result").$type<"success" | "failure">().notNull(),
    failureCode: text("failure_code"),
    metadata: jsonObjectColumn("metadata").notNull(),
    occurredAt: createdAtColumn(),
  },
  (table) => [
    index("audit_events_household_time_idx").on(table.householdId, table.occurredAt),
    index("audit_events_actor_idx").on(table.actorId),
    foreignKey({
      columns: [table.householdId, table.actorId],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "audit_events_actor_fk",
    }).onDelete("restrict"),
  ],
);

export type AuditEventRow = typeof auditEvents.$inferSelect;
export type NewAuditEventRow = typeof auditEvents.$inferInsert;

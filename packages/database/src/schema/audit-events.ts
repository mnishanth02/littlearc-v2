import type { AuditAction, HouseholdRole } from "@littlearc/domain";
import { index, text } from "drizzle-orm/pg-core";
import { createdAtColumn, jsonObjectColumn, uuidV7Column } from "./_columns.js";
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
    metadata: jsonObjectColumn("metadata").notNull(),
    occurredAt: createdAtColumn(),
  },
  (table) => [
    index("audit_events_household_time_idx").on(table.householdId, table.occurredAt),
    index("audit_events_actor_idx").on(table.actorId),
  ],
);

export type AuditEventRow = typeof auditEvents.$inferSelect;
export type NewAuditEventRow = typeof auditEvents.$inferInsert;

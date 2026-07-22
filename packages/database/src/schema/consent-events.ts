import type { ConsentPurpose, ConsentState } from "@littlearc/domain";
import { foreignKey, index, text } from "drizzle-orm/pg-core";
import { createdAtColumn, jsonObjectColumn, uuidV7Column } from "./_columns.js";
import { children } from "./children.js";
import { householdMemberships } from "./household-memberships.js";
import { households } from "./households.js";
import { littlearcSchema } from "./schema.js";

export const consentEvents = littlearcSchema.table(
  "consent_events",
  {
    id: uuidV7Column("id").primaryKey(),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    actorMembershipId: uuidV7Column("actor_membership_id").notNull(),
    childId: uuidV7Column("child_id"),
    purpose: text("purpose").$type<ConsentPurpose>().notNull(),
    state: text("state").$type<ConsentState>().notNull(),
    noticeVersion: text("notice_version").notNull(),
    requestId: uuidV7Column("request_id").notNull(),
    disclosure: jsonObjectColumn("disclosure").notNull(),
    occurredAt: createdAtColumn(),
  },
  (table) => [
    index("consent_events_household_time_idx").on(table.householdId, table.occurredAt),
    index("consent_events_actor_idx").on(table.actorMembershipId),
    foreignKey({
      columns: [table.householdId, table.actorMembershipId],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "consent_events_actor_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.childId],
      foreignColumns: [children.householdId, children.id],
      name: "consent_events_child_fk",
    }).onDelete("restrict"),
  ],
);

import type { HouseholdCapability } from "@littlearc/domain";
import { foreignKey, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { createdAtColumn, uuidV7Column } from "./_columns.js";
import { householdMemberships } from "./household-memberships.js";
import { households } from "./households.js";
import { littlearcSchema } from "./schema.js";

export const membershipCapabilities = littlearcSchema.table(
  "membership_capabilities",
  {
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    membershipId: uuidV7Column("membership_id").notNull(),
    capability: text("capability").$type<HouseholdCapability>().notNull(),
    grantedBy: uuidV7Column("granted_by").notNull(),
    grantedAt: createdAtColumn(),
    revokedAt: timestamp("revoked_at", { mode: "string", withTimezone: true }),
  },
  (table) => [
    primaryKey({
      columns: [table.membershipId, table.capability, table.grantedAt],
      name: "membership_capabilities_pk",
    }),
    foreignKey({
      columns: [table.householdId, table.membershipId],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "membership_capabilities_membership_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.grantedBy],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "membership_capabilities_granted_by_fk",
    }).onDelete("restrict"),
  ],
);

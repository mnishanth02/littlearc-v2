import type { HouseholdRole } from "@littlearc/domain";
import { sql } from "drizzle-orm";
import { check, index, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createdAtColumn, uuidV7Column } from "./_columns.js";
import { auth_user } from "./auth.js";
import { households } from "./households.js";
import { littlearcSchema } from "./schema.js";

export const householdMemberships = littlearcSchema.table(
  "household_memberships",
  {
    id: uuidV7Column("id").primaryKey(),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => auth_user.id, { onDelete: "restrict" }),
    role: text("role").$type<HouseholdRole>().notNull(),
    status: text("status").$type<"active" | "revoked">().notNull(),
    invitedBy: uuidV7Column("invited_by"),
    acceptedAt: timestamp("accepted_at", { mode: "string", withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { mode: "string", withTimezone: true }),
    createdAt: createdAtColumn(),
  },
  (table) => [
    unique("household_memberships_household_id_id_unique").on(table.householdId, table.id),
    index("household_memberships_user_status_idx").on(table.userId, table.status),
    index("household_memberships_household_status_idx").on(table.householdId, table.status),
    check("household_memberships_role_check", sql`${table.role} in ('owner', 'caregiver')`),
    check("household_memberships_status_check", sql`${table.status} in ('active', 'revoked')`),
  ],
);

export type HouseholdMembershipRow = typeof householdMemberships.$inferSelect;
export type NewHouseholdMembershipRow = typeof householdMemberships.$inferInsert;

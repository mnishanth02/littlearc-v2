import type { EmergencyCardAccessMode } from "@littlearc/domain";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, text, unique, uniqueIndex } from "drizzle-orm/pg-core";
import {
  createdAtColumn,
  deletedAtColumn,
  revisionColumn,
  updatedAtColumn,
  uuidV7Column,
} from "./_columns.js";
import { children } from "./children.js";
import { householdMemberships } from "./household-memberships.js";
import { households } from "./households.js";
import { littlearcSchema } from "./schema.js";

export const emergencyCards = littlearcSchema.table(
  "emergency_cards",
  {
    id: uuidV7Column("id").primaryKey(),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    childId: uuidV7Column("child_id").notNull(),
    currentVersionId: uuidV7Column("current_version_id"),
    accessMode: text("access_mode").$type<EmergencyCardAccessMode>().notNull(),
    status: text("status").$type<"active" | "archived">().notNull(),
    createdBy: uuidV7Column("created_by").notNull(),
    updatedBy: uuidV7Column("updated_by").notNull(),
    revision: revisionColumn().default(sql`1`),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    deletedAt: deletedAtColumn(),
  },
  (table) => [
    index("emergency_cards_household_idx").on(table.householdId),
    index("emergency_cards_child_idx").on(table.householdId, table.childId),
    uniqueIndex("emergency_cards_one_active_child_idx")
      .on(table.householdId, table.childId)
      .where(sql`${table.status} = 'active' and ${table.deletedAt} is null`),
    unique("emergency_cards_household_id_id_unique").on(table.householdId, table.id),
    check("emergency_cards_revision_check", sql`${table.revision} > 0`),
    check("emergency_cards_access_mode_check", sql`${table.accessMode} = 'standard'`),
    check(
      "emergency_cards_state_check",
      sql`(${table.status} = 'active' and ${table.deletedAt} is null) or (${table.status} = 'archived' and ${table.deletedAt} is not null)`,
    ),
    foreignKey({
      columns: [table.householdId, table.childId],
      foreignColumns: [children.householdId, children.id],
      name: "emergency_cards_child_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.createdBy],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "emergency_cards_created_by_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.updatedBy],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "emergency_cards_updated_by_fk",
    }).onDelete("restrict"),
  ],
);

export type EmergencyCardRow = typeof emergencyCards.$inferSelect;
export type NewEmergencyCardRow = typeof emergencyCards.$inferInsert;

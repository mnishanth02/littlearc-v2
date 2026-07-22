import { sql } from "drizzle-orm";
import { check, foreignKey, index, unique } from "drizzle-orm/pg-core";
import {
  createdAtColumn,
  deletedAtColumn,
  jsonObjectColumn,
  revisionColumn,
  updatedAtColumn,
  uuidV7Column,
} from "./_columns.js";
import { householdMemberships } from "./household-memberships.js";
import { households } from "./households.js";
import { littlearcSchema } from "./schema.js";

export const children = littlearcSchema.table(
  "children",
  {
    id: uuidV7Column("id").primaryKey(),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    encryptedProfile: jsonObjectColumn("encrypted_profile").notNull(),
    accessPolicy: jsonObjectColumn("access_policy").notNull(),
    createdBy: uuidV7Column("created_by").notNull(),
    updatedBy: uuidV7Column("updated_by").notNull(),
    revision: revisionColumn().default(sql`1`),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    deletedAt: deletedAtColumn(),
  },
  (table) => [
    index("children_household_idx").on(table.householdId),
    index("children_household_updated_idx").on(table.householdId, table.updatedAt),
    check("children_revision_check", sql`${table.revision} > 0`),
    unique("children_household_id_id_unique").on(table.householdId, table.id),
    foreignKey({
      columns: [table.householdId, table.createdBy],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "children_created_by_membership_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.updatedBy],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "children_updated_by_membership_fk",
    }).onDelete("restrict"),
  ],
);

export type ChildRow = typeof children.$inferSelect;
export type NewChildRow = typeof children.$inferInsert;

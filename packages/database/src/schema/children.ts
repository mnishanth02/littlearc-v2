import { sql } from "drizzle-orm";
import { index } from "drizzle-orm/pg-core";
import {
  createdAtColumn,
  deletedAtColumn,
  jsonObjectColumn,
  revisionColumn,
  updatedAtColumn,
  uuidV7Column,
} from "./_columns.js";
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
  ],
);

export type ChildRow = typeof children.$inferSelect;
export type NewChildRow = typeof children.$inferInsert;

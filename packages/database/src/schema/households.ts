import { sql } from "drizzle-orm";
import { text } from "drizzle-orm/pg-core";
import {
  createdAtColumn,
  deletedAtColumn,
  revisionColumn,
  updatedAtColumn,
  uuidV7Column,
} from "./_columns.js";
import { littlearcSchema } from "./schema.js";

export const households = littlearcSchema.table("households", {
  id: uuidV7Column("id").primaryKey(),
  status: text("status").notNull().default("active"),
  defaultCountryCode: text("default_country_code").notNull().default("US"),
  accessPolicy: text("access_policy").notNull().default("owner-managed"),
  createdBy: uuidV7Column("created_by").notNull(),
  updatedBy: uuidV7Column("updated_by").notNull(),
  revision: revisionColumn().default(sql`1`),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
  deletedAt: deletedAtColumn(),
});

export type HouseholdRow = typeof households.$inferSelect;
export type NewHouseholdRow = typeof households.$inferInsert;

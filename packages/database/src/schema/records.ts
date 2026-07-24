import type {
  ConfirmationState,
  RecordAccessScope,
  RecordCategory,
  RecordSourceType,
} from "@littlearc/domain";
import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, text, timestamp, unique } from "drizzle-orm/pg-core";
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

export const records = littlearcSchema.table(
  "records",
  {
    id: uuidV7Column("id").primaryKey(),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    childId: uuidV7Column("child_id").notNull(),
    category: text("category").$type<RecordCategory>().notNull(),
    sourceType: text("source_type").$type<RecordSourceType>().notNull(),
    confirmationState: text("confirmation_state").$type<ConfirmationState>().notNull(),
    eventAt: timestamp("event_at", { mode: "string", withTimezone: true }),
    currentVersionId: uuidV7Column("current_version_id"),
    accessScope: text("access_scope").$type<RecordAccessScope>().notNull(),
    aiAssisted: boolean("ai_assisted").notNull().default(false),
    createdBy: uuidV7Column("created_by").notNull(),
    updatedBy: uuidV7Column("updated_by").notNull(),
    revision: revisionColumn().default(sql`1`),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    deletedAt: deletedAtColumn(),
  },
  (table) => [
    index("records_household_idx").on(table.householdId),
    index("records_child_event_idx").on(table.householdId, table.childId, table.eventAt, table.id),
    unique("records_household_id_id_unique").on(table.householdId, table.id),
    check("records_revision_check", sql`${table.revision} > 0`),
    check(
      "records_category_check",
      sql`${table.category} in ('emergency','identity','vaccination','doctor_visit','prescription','document','memory')`,
    ),
    check(
      "records_source_type_check",
      sql`${table.sourceType} in ('manual','imported','ocr_assisted','ai_assisted','provider_issued','government_imported')`,
    ),
    check(
      "records_confirmation_state_check",
      sql`${table.confirmationState} in ('draft','suggested','confirmed','archived')`,
    ),
    check(
      "records_access_scope_check",
      sql`${table.accessScope} in ('selectedHealthRecords','identityDocuments')`,
    ),
    check(
      "records_access_category_check",
      sql`(${table.category} = 'identity' and ${table.accessScope} = 'identityDocuments') or (${table.category} <> 'identity' and ${table.accessScope} = 'selectedHealthRecords')`,
    ),
    check(
      "records_ai_assisted_check",
      sql`${table.aiAssisted} = (${table.sourceType} = 'ai_assisted')`,
    ),
    foreignKey({
      columns: [table.householdId, table.childId],
      foreignColumns: [children.householdId, children.id],
      name: "records_child_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.createdBy],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "records_created_by_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.updatedBy],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "records_updated_by_fk",
    }).onDelete("restrict"),
  ],
);

export type RecordRow = typeof records.$inferSelect;
export type NewRecordRow = typeof records.$inferInsert;

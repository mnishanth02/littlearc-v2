import type { EncryptedEnvelopeV1 } from "@littlearc/crypto";
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  createdAtColumn,
  deletedAtColumn,
  jsonObjectColumn,
  revisionColumn,
  updatedAtColumn,
  uuidV7Column,
} from "./_columns.js";
import { children } from "./children.js";
import { householdMemberships } from "./household-memberships.js";
import { households } from "./households.js";
import { recordVersions } from "./record-versions.js";
import { records } from "./records.js";
import { littlearcSchema } from "./schema.js";

export const timelineEntries = littlearcSchema.table(
  "timeline_entries",
  {
    id: uuidV7Column("id").primaryKey(),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    childId: uuidV7Column("child_id").notNull(),
    entryType: text("entry_type").notNull(),
    eventAt: timestamp("event_at", { mode: "string", withTimezone: true }).notNull(),
    sourceRecordId: uuidV7Column("source_record_id").notNull(),
    sourceVersionId: uuidV7Column("source_version_id").notNull(),
    encryptedPayload: jsonObjectColumn("encrypted_payload").$type<EncryptedEnvelopeV1>().notNull(),
    visibility: text("visibility").notNull(),
    projectionState: text("projection_state").notNull(),
    createdBy: uuidV7Column("created_by").notNull(),
    updatedBy: uuidV7Column("updated_by").notNull(),
    revision: revisionColumn().default(sql`1`),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    deletedAt: deletedAtColumn(),
  },
  (table) => [
    index("timeline_entries_child_event_idx").on(
      table.householdId,
      table.childId,
      table.eventAt,
      table.id,
    ),
    uniqueIndex("timeline_entries_one_active_record_idx")
      .on(table.householdId, table.sourceRecordId)
      .where(sql`${table.projectionState} = 'active' and ${table.deletedAt} is null`),
    unique("timeline_entries_source_version_unique").on(table.householdId, table.sourceVersionId),
    unique("timeline_entries_household_id_id_unique").on(table.householdId, table.id),
    check("timeline_entries_revision_check", sql`${table.revision} > 0`),
    check("timeline_entries_type_check", sql`${table.entryType} = 'record'`),
    check("timeline_entries_visibility_check", sql`${table.visibility} = 'household'`),
    check(
      "timeline_entries_projection_state_check",
      sql`${table.projectionState} in ('active','inactive','tombstoned')`,
    ),
    check(
      "timeline_entries_deleted_state_check",
      sql`(${table.projectionState} = 'tombstoned' and ${table.deletedAt} is not null) or (${table.projectionState} in ('active','inactive') and ${table.deletedAt} is null)`,
    ),
    foreignKey({
      columns: [table.householdId, table.childId],
      foreignColumns: [children.householdId, children.id],
      name: "timeline_entries_child_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.sourceRecordId],
      foreignColumns: [records.householdId, records.id],
      name: "timeline_entries_record_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.sourceRecordId, table.sourceVersionId],
      foreignColumns: [recordVersions.householdId, recordVersions.recordId, recordVersions.id],
      name: "timeline_entries_version_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.createdBy],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "timeline_entries_created_by_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.updatedBy],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "timeline_entries_updated_by_fk",
    }).onDelete("restrict"),
  ],
);

export type TimelineEntryRow = typeof timelineEntries.$inferSelect;
export type NewTimelineEntryRow = typeof timelineEntries.$inferInsert;

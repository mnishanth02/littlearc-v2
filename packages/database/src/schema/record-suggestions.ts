import type { EncryptedEnvelopeV1 } from "@littlearc/crypto";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, text, timestamp } from "drizzle-orm/pg-core";
import { createdAtColumn, jsonObjectColumn, uuidV7Column } from "./_columns.js";
import { consentEvents } from "./consent-events.js";
import { householdMemberships } from "./household-memberships.js";
import { households } from "./households.js";
import { recordVersions } from "./record-versions.js";
import { records } from "./records.js";
import { littlearcSchema } from "./schema.js";

export const recordSuggestions = littlearcSchema.table(
  "record_suggestions",
  {
    id: uuidV7Column("id").primaryKey(),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    recordId: uuidV7Column("record_id").notNull(),
    recordVersionId: uuidV7Column("record_version_id"),
    fieldPath: text("field_path").notNull(),
    encryptedSuggestion: jsonObjectColumn("encrypted_suggestion")
      .$type<EncryptedEnvelopeV1>()
      .notNull(),
    encryptedSourceSpan: jsonObjectColumn("encrypted_source_span")
      .$type<EncryptedEnvelopeV1>()
      .notNull(),
    confidenceBucket: text("confidence_bucket").notNull(),
    extractorType: text("extractor_type").notNull(),
    modelId: text("model_id"),
    promptVersion: text("prompt_version"),
    consentEventId: uuidV7Column("consent_event_id"),
    reviewState: text("review_state").notNull(),
    reviewedBy: uuidV7Column("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { mode: "string", withTimezone: true }),
    createdAt: createdAtColumn(),
    expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }).notNull(),
  },
  (table) => [
    index("record_suggestions_pending_idx").on(table.householdId, table.recordId, table.createdAt),
    check(
      "record_suggestions_field_path_check",
      sql`char_length(${table.fieldPath}) between 1 and 240 and ${table.fieldPath} !~ '[[:space:]]'`,
    ),
    check(
      "record_suggestions_confidence_check",
      sql`${table.confidenceBucket} in ('low','medium','high')`,
    ),
    check(
      "record_suggestions_extractor_check",
      sql`${table.extractorType} in ('local_ocr','cloud_ocr','cloud_ai')`,
    ),
    check(
      "record_suggestions_review_state_check",
      sql`${table.reviewState} in ('pending','accepted','rejected','expired')`,
    ),
    check(
      "record_suggestions_review_pair_check",
      sql`(${table.reviewState} = 'pending' and ${table.reviewedBy} is null and ${table.reviewedAt} is null) or (${table.reviewState} in ('accepted','rejected') and ${table.reviewedBy} is not null and ${table.reviewedAt} is not null) or (${table.reviewState} = 'expired' and ${table.reviewedBy} is null)`,
    ),
    check(
      "record_suggestions_cloud_consent_check",
      sql`(${table.extractorType} in ('cloud_ocr','cloud_ai') and ${table.consentEventId} is not null) or (${table.extractorType} = 'local_ocr')`,
    ),
    foreignKey({
      columns: [table.householdId, table.recordId],
      foreignColumns: [records.householdId, records.id],
      name: "record_suggestions_record_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.recordId, table.recordVersionId],
      foreignColumns: [recordVersions.householdId, recordVersions.recordId, recordVersions.id],
      name: "record_suggestions_version_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.consentEventId],
      foreignColumns: [consentEvents.householdId, consentEvents.id],
      name: "record_suggestions_consent_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.reviewedBy],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "record_suggestions_reviewed_by_fk",
    }).onDelete("restrict"),
  ],
);

export type RecordSuggestionRow = typeof recordSuggestions.$inferSelect;
export type NewRecordSuggestionRow = typeof recordSuggestions.$inferInsert;

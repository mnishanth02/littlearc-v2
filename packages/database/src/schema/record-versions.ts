import type { EncryptedEnvelopeV1 } from "@littlearc/crypto";
import type {
  ConfirmationState,
  RecordSourceType,
  RecordVersionPayloadSchemaVersion,
} from "@littlearc/domain";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createdAtColumn, jsonObjectColumn, uuidV7Column } from "./_columns.js";
import { householdMemberships } from "./household-memberships.js";
import { households } from "./households.js";
import { records } from "./records.js";
import { littlearcSchema } from "./schema.js";

export const recordVersions = littlearcSchema.table(
  "record_versions",
  {
    id: uuidV7Column("id").primaryKey(),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    recordId: uuidV7Column("record_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    payloadSchemaVersion: integer("payload_schema_version")
      .$type<RecordVersionPayloadSchemaVersion>()
      .notNull(),
    encryptedPayload: jsonObjectColumn("encrypted_payload").$type<EncryptedEnvelopeV1>().notNull(),
    confirmationState: text("confirmation_state").$type<ConfirmationState>().notNull(),
    provenanceType: text("provenance_type").$type<RecordSourceType>().notNull(),
    sourceIssuerId: uuidV7Column("source_issuer_id"),
    confirmedBy: uuidV7Column("confirmed_by"),
    confirmedAt: timestamp("confirmed_at", { mode: "string", withTimezone: true }),
    supersedesVersionId: uuidV7Column("supersedes_version_id"),
    createdBy: uuidV7Column("created_by").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("record_versions_record_created_idx").on(
      table.householdId,
      table.recordId,
      table.createdAt,
    ),
    unique("record_versions_record_version_unique").on(
      table.householdId,
      table.recordId,
      table.versionNumber,
    ),
    unique("record_versions_current_fk_unique").on(table.householdId, table.recordId, table.id),
    check("record_versions_number_check", sql`${table.versionNumber} > 0`),
    check("record_versions_payload_schema_check", sql`${table.payloadSchemaVersion} = 1`),
    check(
      "record_versions_confirmation_state_check",
      sql`${table.confirmationState} in ('draft','suggested','confirmed','archived')`,
    ),
    check(
      "record_versions_provenance_check",
      sql`${table.provenanceType} in ('manual','imported','ocr_assisted','ai_assisted','provider_issued','government_imported')`,
    ),
    check(
      "record_versions_confirmation_pair_check",
      sql`(${table.confirmationState} in ('confirmed','archived') and ${table.confirmedBy} is not null and ${table.confirmedAt} is not null) or (${table.confirmationState} in ('draft','suggested') and ${table.confirmedBy} is null and ${table.confirmedAt} is null)`,
    ),
    check(
      "record_versions_trusted_issuer_check",
      sql`(${table.provenanceType} in ('provider_issued','government_imported') and ${table.sourceIssuerId} is not null) or (${table.provenanceType} not in ('provider_issued','government_imported') and ${table.sourceIssuerId} is null)`,
    ),
    foreignKey({
      columns: [table.householdId, table.recordId],
      foreignColumns: [records.householdId, records.id],
      name: "record_versions_record_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.confirmedBy],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "record_versions_confirmed_by_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.createdBy],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "record_versions_created_by_fk",
    }).onDelete("restrict"),
  ],
);

export type RecordVersionRow = typeof recordVersions.$inferSelect;
export type NewRecordVersionRow = typeof recordVersions.$inferInsert;

import type { EncryptedEnvelopeV1 } from "@littlearc/crypto";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createdAtColumn, jsonObjectColumn, uuidV7Column } from "./_columns.js";
import { emergencyCards } from "./emergency-cards.js";
import { householdMemberships } from "./household-memberships.js";
import { households } from "./households.js";
import { littlearcSchema } from "./schema.js";

export const emergencyCardVersions = littlearcSchema.table(
  "emergency_card_versions",
  {
    id: uuidV7Column("id").primaryKey(),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    emergencyCardId: uuidV7Column("emergency_card_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    encryptedPayload: jsonObjectColumn("encrypted_payload").$type<EncryptedEnvelopeV1>().notNull(),
    confirmedBy: uuidV7Column("confirmed_by").notNull(),
    confirmedAt: timestamp("confirmed_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    sourceRevision: integer("source_revision").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("emergency_card_versions_card_idx").on(
      table.householdId,
      table.emergencyCardId,
      table.versionNumber,
    ),
    unique("emergency_card_versions_card_version_unique").on(
      table.emergencyCardId,
      table.versionNumber,
    ),
    unique("emergency_card_versions_current_fk_unique").on(
      table.householdId,
      table.emergencyCardId,
      table.id,
    ),
    check("emergency_card_versions_number_check", sql`${table.versionNumber} > 0`),
    check("emergency_card_versions_revision_check", sql`${table.sourceRevision} > 0`),
    foreignKey({
      columns: [table.householdId, table.emergencyCardId],
      foreignColumns: [emergencyCards.householdId, emergencyCards.id],
      name: "emergency_card_versions_card_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.confirmedBy],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "emergency_card_versions_confirmed_by_fk",
    }).onDelete("restrict"),
  ],
);

export type EmergencyCardVersionRow = typeof emergencyCardVersions.$inferSelect;
export type NewEmergencyCardVersionRow = typeof emergencyCardVersions.$inferInsert;

import { index, integer, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { createdAtColumn, jsonObjectColumn, uuidV7Column } from "./_columns.js";
import { households } from "./households.js";
import { littlearcSchema } from "./schema.js";

export const idempotencyResults = littlearcSchema.table(
  "idempotency_results",
  {
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    actorId: uuidV7Column("actor_id").notNull(),
    idempotencyKey: uuidV7Column("idempotency_key").notNull(),
    mutationId: uuidV7Column("mutation_id").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: jsonObjectColumn("response_body").notNull(),
    expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }).notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    primaryKey({
      columns: [table.householdId, table.actorId, table.idempotencyKey],
      name: "idempotency_results_pk",
    }),
    index("idempotency_results_expires_at_idx").on(table.expiresAt),
    index("idempotency_results_mutation_idx").on(table.householdId, table.mutationId),
  ],
);

export type IdempotencyResultRow = typeof idempotencyResults.$inferSelect;
export type NewIdempotencyResultRow = typeof idempotencyResults.$inferInsert;

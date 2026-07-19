import { index, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createdAtColumn, jsonObjectColumn, uuidV7Column } from "./_columns.js";
import { households } from "./households.js";
import { littlearcSchema } from "./schema.js";

export const outboxEvents = littlearcSchema.table(
  "outbox_events",
  {
    id: uuidV7Column("id").primaryKey(),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: uuidV7Column("aggregate_id").notNull(),
    payload: jsonObjectColumn("payload").notNull(),
    availableAt: timestamp("available_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    dispatchedAt: timestamp("dispatched_at", { mode: "string", withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("outbox_events_pending_idx").on(table.dispatchedAt, table.availableAt),
    index("outbox_events_household_created_idx").on(table.householdId, table.createdAt),
  ],
);

export type OutboxEventRow = typeof outboxEvents.$inferSelect;
export type NewOutboxEventRow = typeof outboxEvents.$inferInsert;

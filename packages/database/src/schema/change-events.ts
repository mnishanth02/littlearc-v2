import type { Revision, UuidV7 } from "@littlearc/domain";
import { bigserial, index, integer, text, timestamp } from "drizzle-orm/pg-core";
import { jsonObjectColumn, uuidV7Column } from "./_columns.js";
import { households } from "./households.js";
import { littlearcSchema } from "./schema.js";

export const changeEvents = littlearcSchema.table(
  "change_events",
  {
    sequence: bigserial("sequence", { mode: "number" }).primaryKey(),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuidV7Column("entity_id").notNull(),
    operation: text("operation").$type<"upsert" | "delete">().notNull(),
    revision: integer("revision").$type<Revision>().notNull(),
    actorId: uuidV7Column("actor_id").$type<UuidV7 | null>(),
    mutationId: uuidV7Column("mutation_id").$type<UuidV7 | null>(),
    payload: jsonObjectColumn("payload"),
    changedAt: timestamp("changed_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("change_events_household_sequence_idx").on(table.householdId, table.sequence),
    index("change_events_entity_idx").on(table.householdId, table.entityType, table.entityId),
  ],
);

export type ChangeEventRow = typeof changeEvents.$inferSelect;
export type NewChangeEventRow = typeof changeEvents.$inferInsert;

import { index, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { byteaColumn, createdAtColumn, uuidV7Column } from "./_columns.js";
import { households } from "./households.js";
import { littlearcSchema } from "./schema.js";

export const householdKeys = littlearcSchema.table(
  "household_keys",
  {
    id: uuidV7Column("id").primaryKey(),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    keyVersion: integer("key_version").notNull(),
    wrappedKey: byteaColumn("wrapped_key").notNull(),
    wrapNonce: byteaColumn("wrap_nonce").notNull(),
    wrappingKeyVersion: integer("wrapping_key_version").notNull(),
    algorithm: text("algorithm").notNull(),
    status: text("status").$type<"active" | "retired">().notNull(),
    createdAt: createdAtColumn(),
    retiredAt: timestamp("retired_at", { mode: "string", withTimezone: true }),
  },
  (table) => [
    unique("household_keys_household_version_unique").on(table.householdId, table.keyVersion),
    index("household_keys_household_status_idx").on(table.householdId, table.status),
  ],
);

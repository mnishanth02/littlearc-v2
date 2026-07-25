import { index, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createdAtColumn, updatedAtColumn, uuidV7Column } from "./_columns.js";
import { auth_user } from "./auth.js";
import { households } from "./households.js";
import { littlearcSchema } from "./schema.js";

export const devices = littlearcSchema.table(
  "devices",
  {
    id: uuidV7Column("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => auth_user.id, { onDelete: "restrict" }),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    platform: text("platform").notNull(),
    appVersion: text("app_version").notNull(),
    enrollmentStatus: text("enrollment_status").notNull(),
    lastSeenAt: timestamp("last_seen_at", { mode: "string", withTimezone: true }),
    revokedAt: timestamp("revoked_at", { mode: "string", withTimezone: true }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    unique("devices_id_household_unique").on(table.id, table.householdId),
    index("devices_user_status_idx").on(table.userId, table.enrollmentStatus),
    index("devices_household_status_idx").on(table.householdId, table.enrollmentStatus),
  ],
);

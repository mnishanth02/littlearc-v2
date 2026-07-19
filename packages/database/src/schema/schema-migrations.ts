import { text, timestamp } from "drizzle-orm/pg-core";
import { littlearcSchema } from "./schema.js";

export const schemaMigrations = littlearcSchema.table("schema_migrations", {
  version: text("version").primaryKey(),
  checksumSha256: text("checksum_sha256").notNull(),
  appliedAt: timestamp("applied_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
});

export type SchemaMigrationRow = typeof schemaMigrations.$inferSelect;
export type NewSchemaMigrationRow = typeof schemaMigrations.$inferInsert;

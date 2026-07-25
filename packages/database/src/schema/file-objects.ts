import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { byteaColumn, createdAtColumn, updatedAtColumn, uuidV7Column } from "./_columns.js";
import { children } from "./children.js";
import { households } from "./households.js";
import { littlearcSchema } from "./schema.js";

export const fileObjects = littlearcSchema.table(
  "file_objects",
  {
    id: uuidV7Column("id").primaryKey(),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    childId: uuidV7Column("child_id").notNull(),
    originSessionId: uuidV7Column("origin_session_id").notNull(),
    storageKey: text("storage_key").notNull(),
    ciphertextBytes: integer("ciphertext_bytes").notNull(),
    ciphertextSha256: text("ciphertext_sha256").notNull(),
    declaredMime: text("declared_mime").notNull(),
    wrappedFileKey: byteaColumn("wrapped_file_key").notNull(),
    wrapNonce: byteaColumn("wrap_nonce").notNull(),
    contentNonce: byteaColumn("content_nonce").notNull(),
    authTag: byteaColumn("auth_tag").notNull(),
    keyVersion: integer("key_version").notNull(),
    aadVersion: integer("aad_version").notNull(),
    uploadState: text("upload_state").$type<"uploaded">().notNull(),
    validationState: text("validation_state").$type<"pending">().notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    deletedAt: timestamp("deleted_at", { mode: "string", withTimezone: true }),
  },
  (table) => [
    unique("file_objects_household_id_id_unique").on(table.householdId, table.id),
    unique("file_objects_storage_key_unique").on(table.storageKey),
    unique("file_objects_origin_session_unique").on(table.householdId, table.originSessionId),
    index("file_objects_child_created_idx").on(table.householdId, table.childId, table.createdAt),
    check(
      "file_objects_ciphertext_size_check",
      sql`${table.ciphertextBytes} > 0 and ${table.ciphertextBytes} <= 26214464`,
    ),
    check("file_objects_sha256_check", sql`${table.ciphertextSha256} ~ '^[0-9a-f]{64}$'`),
    check(
      "file_objects_declared_mime_check",
      sql`${table.declaredMime} in ('image/jpeg','image/png','image/heic','application/pdf')`,
    ),
    check("file_objects_wrap_nonce_check", sql`octet_length(${table.wrapNonce}) = 12`),
    check("file_objects_content_nonce_check", sql`octet_length(${table.contentNonce}) = 12`),
    check("file_objects_auth_tag_check", sql`octet_length(${table.authTag}) = 16`),
    check("file_objects_key_version_check", sql`${table.keyVersion} > 0`),
    check("file_objects_aad_version_check", sql`${table.aadVersion} = 1`),
    foreignKey({
      columns: [table.householdId, table.childId],
      foreignColumns: [children.householdId, children.id],
      name: "file_objects_child_fk",
    }).onDelete("restrict"),
  ],
);

export type FileObjectRow = typeof fileObjects.$inferSelect;
export type NewFileObjectRow = typeof fileObjects.$inferInsert;

import type { FileDerivativeState, FilePreviewSafeErrorCode } from "@littlearc/domain";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { byteaColumn, createdAtColumn, updatedAtColumn, uuidV7Column } from "./_columns.js";
import { fileObjects } from "./file-objects.js";
import { households } from "./households.js";
import { littlearcSchema } from "./schema.js";

export const fileDerivatives = littlearcSchema.table(
  "file_derivatives",
  {
    id: uuidV7Column("id").primaryKey(),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    sourceFileObjectId: uuidV7Column("source_file_object_id").notNull(),
    kind: text("kind").$type<"validation_preview">().notNull(),
    policyVersion: integer("policy_version").notNull(),
    state: text("state").$type<FileDerivativeState>().notNull(),
    storageKey: text("storage_key"),
    ciphertextBytes: integer("ciphertext_bytes"),
    ciphertextSha256: text("ciphertext_sha256"),
    wrappedFileKey: byteaColumn("wrapped_file_key"),
    wrapNonce: byteaColumn("wrap_nonce"),
    contentNonce: byteaColumn("content_nonce"),
    authTag: byteaColumn("auth_tag"),
    keyVersion: integer("key_version"),
    aadVersion: integer("aad_version").notNull().default(1),
    detectedMime: text("detected_mime"),
    pixelWidth: integer("pixel_width"),
    pixelHeight: integer("pixel_height"),
    attemptCount: integer("attempt_count").notNull().default(0),
    attemptId: uuidV7Column("attempt_id"),
    leaseExpiresAt: timestamp("lease_expires_at", { mode: "string", withTimezone: true }),
    startedAt: timestamp("started_at", { mode: "string", withTimezone: true }),
    completedAt: timestamp("completed_at", { mode: "string", withTimezone: true }),
    safeErrorCode: text("safe_error_code").$type<FilePreviewSafeErrorCode>(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    deletedAt: timestamp("deleted_at", { mode: "string", withTimezone: true }),
  },
  (table) => [
    unique("file_derivatives_source_kind_policy_unique").on(
      table.sourceFileObjectId,
      table.kind,
      table.policyVersion,
    ),
    unique("file_derivatives_storage_key_unique").on(table.storageKey),
    index("file_derivatives_queue_idx").on(table.state, table.leaseExpiresAt, table.updatedAt),
    foreignKey({
      columns: [table.householdId, table.sourceFileObjectId],
      foreignColumns: [fileObjects.householdId, fileObjects.id],
      name: "file_derivatives_source_fk",
    }).onDelete("restrict"),
    check("file_derivatives_kind_check", sql`${table.kind} = 'validation_preview'`),
    check("file_derivatives_policy_check", sql`${table.policyVersion} = 1`),
    check(
      "file_derivatives_state_check",
      sql`${table.state} in ('pending','queued','rendering','result_pending_cleanup','ready','failed')`,
    ),
    check(
      "file_derivatives_ciphertext_size_check",
      sql`${table.ciphertextBytes} is null or ${table.ciphertextBytes} between 1 and 1048576`,
    ),
    check(
      "file_derivatives_sha256_check",
      sql`${table.ciphertextSha256} is null or ${table.ciphertextSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "file_derivatives_crypto_check",
      sql`(${table.wrappedFileKey} is null and ${table.wrapNonce} is null and ${table.contentNonce} is null and ${table.authTag} is null and ${table.keyVersion} is null)
        or (octet_length(${table.wrappedFileKey}) = 48 and octet_length(${table.wrapNonce}) = 12
          and octet_length(${table.contentNonce}) = 12 and octet_length(${table.authTag}) = 16
          and ${table.keyVersion} > 0)`,
    ),
    check("file_derivatives_aad_check", sql`${table.aadVersion} = 1`),
    check(
      "file_derivatives_mime_check",
      sql`${table.detectedMime} is null or ${table.detectedMime} = 'image/jpeg'`,
    ),
    check(
      "file_derivatives_dimensions_check",
      sql`(${table.pixelWidth} is null and ${table.pixelHeight} is null)
        or (${table.pixelWidth} between 1 and 1600 and ${table.pixelHeight} between 1 and 1600)`,
    ),
  ],
);

export type FileDerivativeRow = typeof fileDerivatives.$inferSelect;
export type NewFileDerivativeRow = typeof fileDerivatives.$inferInsert;

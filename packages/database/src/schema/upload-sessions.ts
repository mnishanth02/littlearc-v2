import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { byteaColumn, createdAtColumn, updatedAtColumn, uuidV7Column } from "./_columns.js";
import { children } from "./children.js";
import { devices } from "./devices.js";
import { householdMemberships } from "./household-memberships.js";
import { households } from "./households.js";
import { littlearcSchema } from "./schema.js";

export type UploadPartRow = {
  readonly etag: string;
  readonly partNumber: number;
  readonly size: number;
};

export type UploadSessionState =
  | "created"
  | "uploading"
  | "completing"
  | "uploaded"
  | "cancelled"
  | "expiring"
  | "expired"
  | "failed";

export const uploadSessions = littlearcSchema.table(
  "upload_sessions",
  {
    id: uuidV7Column("id").primaryKey(),
    householdId: uuidV7Column("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    createdBy: uuidV7Column("created_by").notNull(),
    childId: uuidV7Column("child_id").notNull(),
    deviceId: uuidV7Column("device_id").notNull(),
    fileObjectId: uuidV7Column("file_object_id").notNull(),
    captureAssetId: uuidV7Column("capture_asset_id").notNull(),
    objectKey: text("object_key").notNull(),
    providerUploadId: text("provider_upload_id").notNull(),
    status: text("status").$type<UploadSessionState>().notNull(),
    expectedCiphertextBytes: integer("expected_ciphertext_bytes").notNull(),
    expectedCiphertextSha256: text("expected_ciphertext_sha256").notNull(),
    declaredMime: text("declared_mime").notNull(),
    wrappedFileKey: byteaColumn("wrapped_file_key").notNull(),
    wrapNonce: byteaColumn("wrap_nonce").notNull(),
    contentNonce: byteaColumn("content_nonce").notNull(),
    authTag: byteaColumn("auth_tag").notNull(),
    keyVersion: integer("key_version").notNull(),
    aadVersion: integer("aad_version").notNull(),
    parts: jsonb("parts").$type<ReadonlyArray<UploadPartRow>>().notNull().default(sql`'[]'::jsonb`),
    safeErrorCode: text("safe_error_code"),
    expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }).notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    completedAt: timestamp("completed_at", { mode: "string", withTimezone: true }),
  },
  (table) => [
    unique("upload_sessions_household_id_id_unique").on(table.householdId, table.id),
    unique("upload_sessions_file_object_unique").on(table.householdId, table.fileObjectId),
    unique("upload_sessions_object_key_unique").on(table.objectKey),
    index("upload_sessions_household_status_idx").on(
      table.householdId,
      table.status,
      table.updatedAt,
    ),
    index("upload_sessions_expiry_idx").on(table.status, table.expiresAt),
    check(
      "upload_sessions_status_check",
      sql`${table.status} in ('created','uploading','completing','uploaded','cancelled','expiring','expired','failed')`,
    ),
    check(
      "upload_sessions_ciphertext_size_check",
      sql`${table.expectedCiphertextBytes} > 0 and ${table.expectedCiphertextBytes} <= 26214464`,
    ),
    check(
      "upload_sessions_sha256_check",
      sql`${table.expectedCiphertextSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "upload_sessions_declared_mime_check",
      sql`${table.declaredMime} in ('image/jpeg','image/png','image/heic','application/pdf')`,
    ),
    check("upload_sessions_wrapped_key_check", sql`octet_length(${table.wrappedFileKey}) = 48`),
    check("upload_sessions_wrap_nonce_check", sql`octet_length(${table.wrapNonce}) = 12`),
    check("upload_sessions_content_nonce_check", sql`octet_length(${table.contentNonce}) = 12`),
    check("upload_sessions_auth_tag_check", sql`octet_length(${table.authTag}) = 16`),
    check("upload_sessions_key_version_check", sql`${table.keyVersion} > 0`),
    check("upload_sessions_aad_version_check", sql`${table.aadVersion} = 1`),
    foreignKey({
      columns: [table.householdId, table.childId],
      foreignColumns: [children.householdId, children.id],
      name: "upload_sessions_child_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.householdId, table.createdBy],
      foreignColumns: [householdMemberships.householdId, householdMemberships.id],
      name: "upload_sessions_created_by_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.deviceId, table.householdId],
      foreignColumns: [devices.id, devices.householdId],
      name: "upload_sessions_device_fk",
    }).onDelete("restrict"),
  ],
);

export type UploadSessionRow = typeof uploadSessions.$inferSelect;
export type NewUploadSessionRow = typeof uploadSessions.$inferInsert;

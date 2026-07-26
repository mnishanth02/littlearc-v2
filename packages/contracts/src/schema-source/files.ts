import { z } from "./openapi-zod.js";
import { utcTimestampSchema, uuidV7Schema } from "./primitives.js";

export const fileMimeTypes = ["image/jpeg", "image/png", "image/heic", "application/pdf"] as const;
export const fileMimeSchema = z.enum(fileMimeTypes);
export const ciphertextSha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const base64Schema = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/);

export const uploadPartSchema = z
  .object({
    etag: z.string().min(1).max(256),
    partNumber: z.number().int().min(1).max(10_000),
    size: z
      .number()
      .int()
      .positive()
      .max(5 * 1024 * 1024),
  })
  .strict();

export const uploadSessionStateSchema = z.enum([
  "created",
  "uploading",
  "completing",
  "uploaded",
  "cancelled",
  "expired",
  "failed",
]);

export const createUploadSessionRequestSchema = z
  .object({
    aadVersion: z.literal(1),
    authTag: base64Schema,
    captureAssetId: uuidV7Schema,
    childId: uuidV7Schema,
    ciphertextBytes: z
      .number()
      .int()
      .positive()
      .max(25 * 1024 * 1024 + 28),
    ciphertextSha256: ciphertextSha256Schema,
    contentNonce: base64Schema,
    declaredMime: fileMimeSchema,
    deviceId: uuidV7Schema,
    encodedFileKey: base64Schema,
    fileObjectId: uuidV7Schema,
    uploadSessionId: uuidV7Schema,
  })
  .strict();

export const uploadSessionSchema = z
  .object({
    expiresAt: utcTimestampSchema,
    fileObjectId: uuidV7Schema,
    partBytes: z.literal(5 * 1024 * 1024),
    parts: z.array(uploadPartSchema),
    safeErrorCode: z.string().max(80).nullable(),
    sessionId: uuidV7Schema,
    state: uploadSessionStateSchema,
  })
  .strict();

export const signedUploadPartSchema = z
  .object({
    expiresAt: utcTimestampSchema,
    method: z.literal("PUT"),
    partNumber: z.number().int().min(1).max(10_000),
    url: z.string().url(),
  })
  .strict();

export const reconcileUploadPartsRequestSchema = z
  .object({
    parts: z.array(uploadPartSchema).max(6),
  })
  .strict();

export const completeUploadRequestSchema = z
  .object({
    parts: z.array(uploadPartSchema).min(1).max(6),
  })
  .strict();

export const fileObjectProjectionSchema = z
  .object({
    ciphertextBytes: z.number().int().positive(),
    ciphertextSha256: ciphertextSha256Schema,
    fileObjectId: uuidV7Schema,
    uploadState: z.literal("uploaded"),
    validationState: z.enum([
      "pending",
      "queued",
      "validating",
      "result_pending_cleanup",
      "ready",
      "rejected",
      "failed",
    ]),
  })
  .strict();

export const filePreviewStateSchema = z.enum([
  "not_authorized",
  "pending",
  "processing",
  "ready",
  "failed",
]);

export const fileValidationSafeErrorCodeSchema = z.enum([
  "type_mismatch",
  "unsupported_format",
  "malformed_structure",
  "resource_limit_exceeded",
  "ciphertext_integrity_mismatch",
  "authenticated_decryption_failed",
  "pdf_encrypted",
  "pdf_active_content",
  "pdf_embedded_content",
  "malware_detected",
  "scanner_unavailable",
  "scanner_signatures_stale",
  "plaintext_cleanup_retry",
  "validation_retry_exhausted",
]);

export const fileProcessingStatusSchema = z
  .object({
    fileObjectId: uuidV7Schema,
    previewState: filePreviewStateSchema,
    safeErrorCode: fileValidationSafeErrorCodeSchema.nullable(),
    updatedAt: utcTimestampSchema,
    validationState: fileObjectProjectionSchema.shape.validationState,
  })
  .strict();

export const fileDownloadGrantSchema = z
  .object({
    aadVersion: z.literal(1),
    authTag: base64Schema,
    ciphertextBytes: z.number().int().positive(),
    ciphertextSha256: ciphertextSha256Schema,
    contentNonce: base64Schema,
    declaredMime: fileMimeSchema,
    encodedFileKey: base64Schema,
    expiresAt: utcTimestampSchema,
    fileObjectId: uuidV7Schema,
    method: z.literal("GET"),
    url: z.string().url(),
  })
  .strict();

export const filePreviewDownloadGrantSchema = z
  .object({
    aadVersion: z.literal(1),
    authTag: base64Schema,
    ciphertextBytes: z
      .number()
      .int()
      .positive()
      .max(1024 * 1024),
    ciphertextSha256: ciphertextSha256Schema,
    contentNonce: base64Schema,
    declaredMime: z.literal("image/jpeg"),
    derivativeId: uuidV7Schema,
    encodedFileKey: base64Schema,
    expiresAt: utcTimestampSchema,
    fileObjectId: uuidV7Schema,
    method: z.literal("GET"),
    previewPolicyVersion: z.literal(1),
    url: z.string().url(),
  })
  .strict();

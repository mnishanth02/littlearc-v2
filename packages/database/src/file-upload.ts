import { timingSafeEqual } from "node:crypto";
import type {
  FileEncryptionContext,
  FileKeyCrypto,
  StructuredPayloadCrypto,
  WrappedHouseholdKey,
} from "@littlearc/crypto";
import {
  canPerformHouseholdCapability,
  type HouseholdCapability,
  type HouseholdRole,
  type UuidV7,
} from "@littlearc/domain";
import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./client.js";
import type { UploadPartRow, UploadSessionState } from "./schema/upload-sessions.js";

type SqlTransaction = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];

type Context = {
  readonly grantedCapabilities: ReadonlySet<HouseholdCapability>;
  readonly householdId: UuidV7;
  readonly membershipId: UuidV7;
  readonly role: HouseholdRole;
};

export type InternalUploadSession = {
  readonly aadVersion: 1;
  readonly authTag: Buffer;
  readonly captureAssetId: UuidV7;
  readonly childId: UuidV7;
  readonly contentNonce: Buffer;
  readonly declaredMime: FileEncryptionContext["format"];
  readonly deviceId: UuidV7;
  readonly expectedCiphertextBytes: number;
  readonly expectedCiphertextSha256: string;
  readonly expiresAt: string;
  readonly fileObjectId: UuidV7;
  readonly keyVersion: number;
  readonly objectKey: string;
  readonly parts: ReadonlyArray<UploadPartRow>;
  readonly providerUploadId: string;
  readonly safeErrorCode: string | null;
  readonly sessionId: UuidV7;
  readonly state: UploadSessionState;
  readonly wrapNonce: Buffer;
  readonly wrappedFileKey: Buffer;
};

export type InternalFileObject = {
  readonly aadVersion: 1;
  readonly authTag: Buffer;
  readonly ciphertextBytes: number;
  readonly ciphertextSha256: string;
  readonly contentNonce: Buffer;
  readonly declaredMime: FileEncryptionContext["format"];
  readonly fileObjectId: UuidV7;
  readonly keyVersion: number;
  readonly objectKey: string;
  readonly wrapNonce: Buffer;
  readonly wrappedFileKey: Buffer;
};

export type FileUploadPersistence = {
  readonly begin: (input: {
    readonly authTag: Buffer;
    readonly captureAssetId: UuidV7;
    readonly childId: UuidV7;
    readonly contentNonce: Buffer;
    readonly declaredMime: FileEncryptionContext["format"];
    readonly deviceId: UuidV7;
    readonly expectedCiphertextBytes: number;
    readonly expectedCiphertextSha256: string;
    readonly expiresAt: string;
    readonly fileKey: Buffer;
    readonly fileObjectId: UuidV7;
    readonly identityUserId: string;
    readonly objectKey: string;
    readonly providerUploadId: string;
    readonly requestId: UuidV7;
    readonly sessionId: UuidV7;
  }) => Promise<{ readonly replayed: boolean; readonly session: InternalUploadSession }>;
  readonly cancel: (input: {
    readonly identityUserId: string;
    readonly requestId: UuidV7;
    readonly sessionId: UuidV7;
  }) => Promise<void>;
  readonly complete: (input: {
    readonly identityUserId: string;
    readonly requestId: UuidV7;
    readonly sessionId: UuidV7;
  }) => Promise<InternalFileObject>;
  readonly fail: (input: {
    readonly identityUserId: string;
    readonly safeErrorCode: string;
    readonly sessionId: UuidV7;
  }) => Promise<void>;
  readonly markCompleting: (input: {
    readonly identityUserId: string;
    readonly parts: ReadonlyArray<UploadPartRow>;
    readonly sessionId: UuidV7;
  }) => Promise<InternalUploadSession>;
  readonly readDownload: (input: {
    readonly deviceId: UuidV7;
    readonly fileObjectId: UuidV7;
    readonly identityUserId: string;
    readonly requestId: UuidV7;
  }) => Promise<{ readonly fileKey: Buffer; readonly object: InternalFileObject } | null>;
  readonly readSession: (input: {
    readonly identityUserId: string;
    readonly sessionId: UuidV7;
  }) => Promise<InternalUploadSession | null>;
  readonly reconcile: (input: {
    readonly identityUserId: string;
    readonly parts: ReadonlyArray<UploadPartRow>;
    readonly sessionId: UuidV7;
  }) => Promise<InternalUploadSession>;
};

export class FileUploadPersistenceError extends Error {
  readonly code: "authorization_denied" | "device_required" | "invalid_state" | "not_found";

  constructor(code: FileUploadPersistenceError["code"], message: string) {
    super(message);
    this.name = "FileUploadPersistenceError";
    this.code = code;
  }
}

export function createFileUploadPersistence(options: {
  readonly crypto: StructuredPayloadCrypto;
  readonly database: DatabaseClient;
  readonly fileKeyCrypto: FileKeyCrypto;
}): FileUploadPersistence {
  return {
    begin: (input) =>
      options.database.transaction(async (transaction) => {
        const context = await establishContext(transaction, input.identityUserId);
        requireCapability(context, "addRecords");
        await requireChildAndDevice(transaction, context, input.childId, input.deviceId);
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${input.sessionId}, 0))`,
        );

        const existing = await readSessionRow(transaction, context, input.sessionId, false);
        if (existing) {
          if (
            existing.aadVersion !== 1 ||
            !existing.authTag.equals(input.authTag) ||
            existing.captureAssetId !== input.captureAssetId ||
            existing.childId !== input.childId ||
            !existing.contentNonce.equals(input.contentNonce) ||
            existing.declaredMime !== input.declaredMime ||
            existing.deviceId !== input.deviceId ||
            existing.fileObjectId !== input.fileObjectId ||
            existing.expectedCiphertextSha256 !== input.expectedCiphertextSha256 ||
            existing.expectedCiphertextBytes !== input.expectedCiphertextBytes
          ) {
            throw new FileUploadPersistenceError(
              "invalid_state",
              "The upload idempotency boundary conflicts with existing ciphertext.",
            );
          }
          const householdKey = await readHouseholdKey(transaction, context.householdId);
          const plaintextHouseholdKey = options.crypto.unwrapHouseholdKey(householdKey);
          let existingFileKey: Buffer | undefined;
          try {
            existingFileKey = options.fileKeyCrypto.unwrap(
              {
                keyVersion: existing.keyVersion,
                wrapNonce: existing.wrapNonce,
                wrappedKey: existing.wrappedFileKey,
              },
              plaintextHouseholdKey,
              fileContext(existing, context.householdId),
            );
            if (
              existingFileKey.length !== input.fileKey.length ||
              !timingSafeEqual(existingFileKey, input.fileKey)
            ) {
              throw new FileUploadPersistenceError(
                "invalid_state",
                "The upload idempotency boundary conflicts with existing ciphertext.",
              );
            }
          } finally {
            existingFileKey?.fill(0);
            plaintextHouseholdKey.fill(0);
          }
          return { replayed: true, session: existing };
        }

        const householdKey = await readHouseholdKey(transaction, context.householdId);
        const plaintextHouseholdKey = options.crypto.unwrapHouseholdKey(householdKey);
        try {
          const wrapped = options.fileKeyCrypto.wrap(
            input.fileKey,
            plaintextHouseholdKey,
            fileContext(input, context.householdId),
          );
          await transaction.execute(sql`
            insert into littlearc.upload_sessions (
              id, household_id, created_by, child_id, device_id, file_object_id,
              capture_asset_id, object_key, provider_upload_id, status,
              expected_ciphertext_bytes, expected_ciphertext_sha256, declared_mime,
              wrapped_file_key, wrap_nonce, content_nonce, auth_tag, key_version,
              aad_version, expires_at
            ) values (
              ${input.sessionId}, ${context.householdId}, ${context.membershipId},
              ${input.childId}, ${input.deviceId}, ${input.fileObjectId},
              ${input.captureAssetId}, ${input.objectKey}, ${input.providerUploadId},
              'created', ${input.expectedCiphertextBytes}, ${input.expectedCiphertextSha256},
              ${input.declaredMime}, ${wrapped.wrappedKey}, ${wrapped.wrapNonce},
              ${input.contentNonce}, ${input.authTag}, ${wrapped.keyVersion}, 1,
              ${input.expiresAt}
            )
          `);
          await audit(transaction, context, {
            action: "file_upload_created",
            requestId: input.requestId,
            targetId: input.sessionId,
            targetType: "upload_session",
          });
        } finally {
          plaintextHouseholdKey.fill(0);
        }
        const session = await readSessionRow(transaction, context, input.sessionId, false);
        if (!session) {
          throw new Error("The encrypted upload session was not persisted.");
        }
        return { replayed: false, session };
      }),
    cancel: (input) =>
      options.database.transaction(async (transaction) => {
        const context = await establishContext(transaction, input.identityUserId);
        requireCapability(context, "addRecords");
        const session = await readSessionRow(transaction, context, input.sessionId, true);
        if (!session) {
          throw new FileUploadPersistenceError("not_found", "The upload session was not found.");
        }
        if (session.state === "uploaded") {
          throw new FileUploadPersistenceError(
            "invalid_state",
            "A completed upload cannot be cancelled.",
          );
        }
        if (session.state === "cancelled") {
          return;
        }
        await transaction.execute(sql`
          update littlearc.upload_sessions
          set status = 'cancelled', safe_error_code = null, updated_at = now()
          where household_id = ${context.householdId} and id = ${input.sessionId}
        `);
        await audit(transaction, context, {
          action: "file_upload_cancelled",
          requestId: input.requestId,
          targetId: input.sessionId,
          targetType: "upload_session",
        });
      }),
    complete: (input) =>
      options.database.transaction(async (transaction) => {
        const context = await establishContext(transaction, input.identityUserId);
        requireCapability(context, "addRecords");
        const session = await readSessionRow(transaction, context, input.sessionId, true);
        if (!session) {
          throw new FileUploadPersistenceError("not_found", "The upload session was not found.");
        }
        if (session.state === "uploaded") {
          const existing = await readFileObjectRow(transaction, context, session.fileObjectId);
          if (existing) {
            return existing;
          }
        }
        if (session.state !== "completing") {
          throw new FileUploadPersistenceError(
            "invalid_state",
            "The upload session is not completing.",
          );
        }
        await transaction.execute(sql`
          insert into littlearc.file_objects (
            id, household_id, child_id, origin_session_id, storage_key,
            ciphertext_bytes, ciphertext_sha256, declared_mime, wrapped_file_key,
            wrap_nonce, content_nonce, auth_tag, key_version, aad_version,
            upload_state, validation_state
          ) values (
            ${session.fileObjectId}, ${context.householdId}, ${session.childId},
            ${session.sessionId}, ${session.objectKey}, ${session.expectedCiphertextBytes},
            ${session.expectedCiphertextSha256}, ${session.declaredMime},
            ${session.wrappedFileKey}, ${session.wrapNonce}, ${session.contentNonce},
            ${session.authTag}, ${session.keyVersion}, ${session.aadVersion},
            'uploaded', 'pending'
          )
          on conflict (household_id, origin_session_id) do nothing
        `);
        await transaction.execute(sql`
          update littlearc.upload_sessions
          set status = 'uploaded', safe_error_code = null,
              completed_at = now(), updated_at = now()
          where household_id = ${context.householdId} and id = ${input.sessionId}
        `);
        await audit(transaction, context, {
          action: "file_upload_completed",
          requestId: input.requestId,
          targetId: session.fileObjectId,
          targetType: "file_object",
        });
        const object = await readFileObjectRow(transaction, context, session.fileObjectId);
        if (!object) {
          throw new Error("The encrypted file object was not persisted.");
        }
        return object;
      }),
    fail: (input) =>
      options.database.transaction(async (transaction) => {
        const context = await establishContext(transaction, input.identityUserId);
        await transaction.execute(sql`
          update littlearc.upload_sessions
          set status = 'failed', safe_error_code = ${input.safeErrorCode}, updated_at = now()
          where household_id = ${context.householdId} and id = ${input.sessionId}
            and status <> 'uploaded'
        `);
      }),
    markCompleting: (input) =>
      options.database.transaction(async (transaction) => {
        const context = await establishContext(transaction, input.identityUserId);
        requireCapability(context, "addRecords");
        const session = await readSessionRow(transaction, context, input.sessionId, true);
        if (!session) {
          throw new FileUploadPersistenceError("not_found", "The upload session was not found.");
        }
        if (session.state === "uploaded" || session.state === "completing") {
          return session;
        }
        if (!["created", "uploading"].includes(session.state)) {
          throw new FileUploadPersistenceError(
            "invalid_state",
            "The upload session is not completable.",
          );
        }
        await transaction.execute(sql`
          update littlearc.upload_sessions
          set status = 'completing', parts = ${JSON.stringify(input.parts)}::jsonb,
              updated_at = now()
          where household_id = ${context.householdId} and id = ${input.sessionId}
        `);
        const updated = await readSessionRow(transaction, context, input.sessionId, false);
        if (!updated) {
          throw new Error("The completing upload session became unavailable.");
        }
        return updated;
      }),
    readDownload: (input) =>
      options.database.transaction(async (transaction) => {
        const context = await establishContext(transaction, input.identityUserId);
        requireCapability(context, "viewSelectedHealthRecords");
        await requireActiveDevice(transaction, context, input.deviceId);
        const object = await readFileObjectRow(transaction, context, input.fileObjectId);
        if (!object) {
          return null;
        }
        const householdKey = await readHouseholdKey(transaction, context.householdId);
        const plaintextHouseholdKey = options.crypto.unwrapHouseholdKey(householdKey);
        try {
          const fileKey = options.fileKeyCrypto.unwrap(
            {
              keyVersion: object.keyVersion,
              wrapNonce: object.wrapNonce,
              wrappedKey: object.wrappedFileKey,
            },
            plaintextHouseholdKey,
            {
              aadSchemaVersion: 1,
              format: object.declaredMime,
              householdId: context.householdId,
              objectId: object.fileObjectId,
              purpose: "capture-original",
            },
          );
          await audit(transaction, context, {
            action: "file_download_authorized",
            requestId: input.requestId,
            targetId: object.fileObjectId,
            targetType: "file_object",
          });
          return { fileKey, object };
        } finally {
          plaintextHouseholdKey.fill(0);
        }
      }),
    readSession: (input) =>
      options.database.transaction(async (transaction) => {
        const context = await establishContext(transaction, input.identityUserId);
        requireCapability(context, "addRecords");
        return (await readSessionRow(transaction, context, input.sessionId, false)) ?? null;
      }),
    reconcile: (input) =>
      options.database.transaction(async (transaction) => {
        const context = await establishContext(transaction, input.identityUserId);
        requireCapability(context, "addRecords");
        const session = await readSessionRow(transaction, context, input.sessionId, true);
        if (!session) {
          throw new FileUploadPersistenceError("not_found", "The upload session was not found.");
        }
        if (!["created", "uploading"].includes(session.state)) {
          return session;
        }
        await transaction.execute(sql`
          update littlearc.upload_sessions
          set status = 'uploading', parts = ${JSON.stringify(input.parts)}::jsonb,
              updated_at = now()
          where household_id = ${context.householdId} and id = ${input.sessionId}
        `);
        const updated = await readSessionRow(transaction, context, input.sessionId, false);
        if (!updated) {
          throw new Error("The reconciled upload session became unavailable.");
        }
        return updated;
      }),
  };
}

async function establishContext(
  transaction: SqlTransaction,
  identityUserId: string,
): Promise<Context> {
  await transaction.execute(sql`set local role littlearc_app`);
  await transaction.execute(
    sql`select set_config('littlearc.current_identity_user_id', ${identityUserId}, true)`,
  );
  const membership = await transaction.execute<{
    readonly householdId: UuidV7;
    readonly membershipId: UuidV7;
    readonly role: HouseholdRole;
  }>(sql`
    select household_id as "householdId", id as "membershipId", role
    from littlearc.household_memberships
    where user_id = ${identityUserId} and status = 'active'
    limit 1
  `);
  const context = membership.rows[0];
  if (!context) {
    throw new FileUploadPersistenceError(
      "authorization_denied",
      "An active household membership is required.",
    );
  }
  await transaction.execute(sql`
    select
      set_config('littlearc.current_household_id', ${context.householdId}, true),
      set_config('littlearc.current_actor_id', ${context.membershipId}, true),
      set_config('littlearc.current_actor_role', ${context.role}, true),
      set_config('littlearc.current_identity_user_id', ${identityUserId}, true)
  `);
  const capabilities = await transaction.execute<{ readonly capability: HouseholdCapability }>(sql`
    select capability
    from littlearc.membership_capabilities
    where household_id = ${context.householdId}
      and membership_id = ${context.membershipId}
      and revoked_at is null
  `);
  return {
    ...context,
    grantedCapabilities: new Set(capabilities.rows.map((row) => row.capability)),
  };
}

function requireCapability(context: Context, capability: HouseholdCapability): void {
  if (
    !canPerformHouseholdCapability({
      capability,
      grantedCapabilities: context.grantedCapabilities,
      role: context.role,
    })
  ) {
    throw new FileUploadPersistenceError(
      "authorization_denied",
      "The household capability is required.",
    );
  }
}

async function requireChildAndDevice(
  transaction: SqlTransaction,
  context: Context,
  childId: UuidV7,
  deviceId: UuidV7,
): Promise<void> {
  const child = await transaction.execute(sql`
    select 1 from littlearc.children
    where household_id = ${context.householdId} and id = ${childId} and deleted_at is null
  `);
  if (child.rowCount !== 1) {
    throw new FileUploadPersistenceError("authorization_denied", "The child is unavailable.");
  }
  await requireActiveDevice(transaction, context, deviceId);
}

async function requireActiveDevice(
  transaction: SqlTransaction,
  context: Context,
  deviceId: UuidV7,
): Promise<void> {
  const device = await transaction.execute(sql`
    select 1 from littlearc.devices
    where household_id = ${context.householdId}
      and id = ${deviceId}
      and user_id = current_setting('littlearc.current_identity_user_id', true)
      and enrollment_status = 'active'
      and revoked_at is null
  `);
  if (device.rowCount !== 1) {
    throw new FileUploadPersistenceError(
      "device_required",
      "An active enrolled device is required.",
    );
  }
}

async function readSessionRow(
  transaction: SqlTransaction,
  context: Context,
  sessionId: UuidV7,
  forUpdate: boolean,
): Promise<InternalUploadSession | undefined> {
  const result = await transaction.execute<InternalUploadSession>(sql`
    select
      id as "sessionId",
      file_object_id as "fileObjectId",
      capture_asset_id as "captureAssetId",
      child_id as "childId",
      device_id as "deviceId",
      object_key as "objectKey",
      provider_upload_id as "providerUploadId",
      status as state,
      expected_ciphertext_bytes as "expectedCiphertextBytes",
      expected_ciphertext_sha256 as "expectedCiphertextSha256",
      declared_mime as "declaredMime",
      wrapped_file_key as "wrappedFileKey",
      wrap_nonce as "wrapNonce",
      content_nonce as "contentNonce",
      auth_tag as "authTag",
      key_version as "keyVersion",
      aad_version as "aadVersion",
      parts,
      safe_error_code as "safeErrorCode",
      expires_at as "expiresAt"
    from littlearc.upload_sessions session
    where household_id = ${context.householdId} and id = ${sessionId}
      and exists (
        select 1
        from littlearc.devices device
        where device.id = session.device_id
          and device.household_id = session.household_id
          and device.user_id = current_setting('littlearc.current_identity_user_id', true)
          and device.enrollment_status = 'active'
          and device.revoked_at is null
      )
    ${forUpdate ? sql`for update` : sql``}
  `);
  return result.rows[0];
}

async function readFileObjectRow(
  transaction: SqlTransaction,
  context: Context,
  fileObjectId: UuidV7,
): Promise<InternalFileObject | undefined> {
  const result = await transaction.execute<InternalFileObject>(sql`
    select
      id as "fileObjectId",
      storage_key as "objectKey",
      ciphertext_bytes as "ciphertextBytes",
      ciphertext_sha256 as "ciphertextSha256",
      declared_mime as "declaredMime",
      wrapped_file_key as "wrappedFileKey",
      wrap_nonce as "wrapNonce",
      content_nonce as "contentNonce",
      auth_tag as "authTag",
      key_version as "keyVersion",
      aad_version as "aadVersion"
    from littlearc.file_objects
    where household_id = ${context.householdId}
      and id = ${fileObjectId}
      and deleted_at is null
  `);
  return result.rows[0];
}

async function readHouseholdKey(
  transaction: SqlTransaction,
  householdId: UuidV7,
): Promise<WrappedHouseholdKey> {
  const result = await transaction.execute<WrappedHouseholdKey>(sql`
    select
      key_version as "keyVersion",
      wrap_nonce as "wrapNonce",
      wrapped_key as "wrappedKey",
      wrapping_key_version as "wrappingKeyVersion"
    from littlearc.household_keys
    where household_id = ${householdId} and status = 'active'
    order by key_version desc
    limit 1
  `);
  const key = result.rows[0];
  if (!key) {
    throw new Error("The household encryption key is unavailable.");
  }
  return key;
}

function fileContext(
  input: {
    readonly declaredMime: FileEncryptionContext["format"];
    readonly fileObjectId: UuidV7;
  },
  householdId: UuidV7,
): FileEncryptionContext {
  return {
    aadSchemaVersion: 1,
    format: input.declaredMime,
    householdId,
    objectId: input.fileObjectId,
    purpose: "capture-original",
  };
}

async function audit(
  transaction: SqlTransaction,
  context: Context,
  input: {
    readonly action:
      | "file_download_authorized"
      | "file_upload_cancelled"
      | "file_upload_completed"
      | "file_upload_created";
    readonly requestId: UuidV7;
    readonly targetId: UuidV7;
    readonly targetType: "file_object" | "upload_session";
  },
): Promise<void> {
  await transaction.execute(sql`
    insert into littlearc.audit_events (
      id, household_id, actor_id, actor_role, action, target_type,
      target_id, request_id, result, metadata
    ) values (
      ${input.requestId}, ${context.householdId}, ${context.membershipId},
      ${context.role}, ${input.action}, ${input.targetType}, ${input.targetId},
      ${input.requestId}, 'success', '{}'::jsonb
    )
  `);
}

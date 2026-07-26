import type {
  FileKeyCrypto,
  StructuredPayloadCrypto,
  WrappedHouseholdKey,
} from "@littlearc/crypto";
import {
  canPerformHouseholdCapability,
  createUuidV7,
  type FilePreviewSafeErrorCode,
  type HouseholdCapability,
  type HouseholdRole,
  type UuidV7,
} from "@littlearc/domain";
import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./client.js";
import { FileUploadPersistenceError } from "./file-upload.js";

type SqlTransaction = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];

export type ClaimedFilePreview = {
  readonly derivativeId: UuidV7;
  readonly householdId: UuidV7;
  readonly householdKey: WrappedHouseholdKey;
  readonly sourceAadVersion: 1;
  readonly sourceAuthTag: Buffer;
  readonly sourceCiphertextBytes: number;
  readonly sourceCiphertextSha256: string;
  readonly sourceContentNonce: Buffer;
  readonly sourceFileObjectId: UuidV7;
  readonly sourceKeyVersion: number;
  readonly sourceMime: "application/pdf" | "image/heic" | "image/jpeg" | "image/png";
  readonly sourceObjectKey: string;
  readonly sourceWrappedFileKey: Buffer;
  readonly sourceWrapNonce: Buffer;
};

export type FilePreviewDispatch = {
  readonly derivativeId: UuidV7;
  readonly eventId: UuidV7;
};

export type FilePreviewPersistence = {
  readonly claim: (
    derivativeId: UuidV7,
    attemptId: UuidV7,
    leaseSeconds: number,
  ) => Promise<ClaimedFilePreview | null>;
  readonly claimDispatches: (batchSize: number) => Promise<ReadonlyArray<FilePreviewDispatch>>;
  readonly commit: (derivativeId: UuidV7, attemptId: UuidV7) => Promise<boolean>;
  readonly ensureCandidates: (batchSize: number) => Promise<ReadonlyArray<UuidV7>>;
  readonly failExhausted: (derivativeId: UuidV7) => Promise<boolean>;
  readonly fail: (
    derivativeId: UuidV7,
    attemptId: UuidV7,
    safeErrorCode: "output_invalid" | "output_too_large",
  ) => Promise<boolean>;
  readonly finishDispatch: (eventId: UuidV7, succeeded: boolean) => Promise<void>;
  readonly heartbeat: (
    derivativeId: UuidV7,
    attemptId: UuidV7,
    leaseSeconds: number,
  ) => Promise<boolean>;
  readonly listStale: (batchSize: number) => Promise<
    ReadonlyArray<{
      readonly attemptId: UuidV7;
      readonly derivativeId: UuidV7;
      readonly storageKey: string | null;
    }>
  >;
  readonly propose: (
    derivativeId: UuidV7,
    attemptId: UuidV7,
    result: {
      readonly authTag: Buffer;
      readonly ciphertextBytes: number;
      readonly ciphertextSha256: string;
      readonly contentNonce: Buffer;
      readonly keyVersion: number;
      readonly pixelHeight: number;
      readonly pixelWidth: number;
      readonly storageKey: string;
      readonly wrappedFileKey: Buffer;
      readonly wrapNonce: Buffer;
    },
  ) => Promise<boolean>;
  readonly recover: (derivativeId: UuidV7, attemptId: UuidV7) => Promise<boolean>;
  readonly retry: (
    derivativeId: UuidV7,
    attemptId: UuidV7,
    safeErrorCode: FilePreviewSafeErrorCode,
  ) => Promise<boolean>;
};

type ClaimRow = Omit<ClaimedFilePreview, "householdKey"> & {
  readonly householdKeyVersion: number;
  readonly householdWrapNonce: Buffer;
  readonly householdWrappingKeyVersion: number;
  readonly wrappedHouseholdKey: Buffer;
};

export function createFilePreviewPersistence(database: DatabaseClient): FilePreviewPersistence {
  return {
    async claim(derivativeId, attemptId, leaseSeconds) {
      const result = await database.execute<ClaimRow>(sql`
        select
          derivative_id as "derivativeId",
          source_file_object_id as "sourceFileObjectId",
          household_id as "householdId",
          source_object_key as "sourceObjectKey",
          source_ciphertext_bytes as "sourceCiphertextBytes",
          source_ciphertext_sha256 as "sourceCiphertextSha256",
          source_mime as "sourceMime",
          source_wrapped_file_key as "sourceWrappedFileKey",
          source_wrap_nonce as "sourceWrapNonce",
          source_content_nonce as "sourceContentNonce",
          source_auth_tag as "sourceAuthTag",
          source_key_version as "sourceKeyVersion",
          source_aad_version as "sourceAadVersion",
          wrapped_household_key as "wrappedHouseholdKey",
          household_wrap_nonce as "householdWrapNonce",
          household_key_version as "householdKeyVersion",
          household_wrapping_key_version as "householdWrappingKeyVersion"
        from littlearc.claim_file_preview(${derivativeId}, ${attemptId}, ${leaseSeconds})
      `);
      const row = result.rows[0];
      return row
        ? {
            derivativeId: row.derivativeId,
            householdId: row.householdId,
            householdKey: {
              keyVersion: row.householdKeyVersion,
              wrapNonce: row.householdWrapNonce,
              wrappedKey: row.wrappedHouseholdKey,
              wrappingKeyVersion: row.householdWrappingKeyVersion,
            },
            sourceAadVersion: row.sourceAadVersion,
            sourceAuthTag: row.sourceAuthTag,
            sourceCiphertextBytes: row.sourceCiphertextBytes,
            sourceCiphertextSha256: row.sourceCiphertextSha256,
            sourceContentNonce: row.sourceContentNonce,
            sourceFileObjectId: row.sourceFileObjectId,
            sourceKeyVersion: row.sourceKeyVersion,
            sourceMime: row.sourceMime,
            sourceObjectKey: row.sourceObjectKey,
            sourceWrappedFileKey: row.sourceWrappedFileKey,
            sourceWrapNonce: row.sourceWrapNonce,
          }
        : null;
    },
    async claimDispatches(batchSize) {
      const result = await database.execute<FilePreviewDispatch>(sql`
        select event_id as "eventId", derivative_id as "derivativeId"
        from littlearc.claim_file_preview_outbox(${batchSize})
      `);
      return result.rows;
    },
    async commit(derivativeId, attemptId) {
      return booleanResult(
        await database.execute<{ readonly committed: boolean }>(sql`
          select littlearc.commit_file_preview_result(${derivativeId}, ${attemptId}) as committed
        `),
        "committed",
      );
    },
    async ensureCandidates(batchSize) {
      const sources = await database.execute<{ readonly sourceFileObjectId: UuidV7 }>(sql`
        select source_file_object_id as "sourceFileObjectId"
        from littlearc.list_eligible_file_preview_sources(${batchSize})
      `);
      const derivativeIds: UuidV7[] = [];
      for (const source of sources.rows) {
        const candidateId = createUuidV7(randomBytes(10));
        const result = await database.execute<{ readonly derivativeId: UuidV7 | null }>(sql`
          select littlearc.ensure_file_preview_candidate(
            ${source.sourceFileObjectId}, ${candidateId}
          ) as "derivativeId"
        `);
        const derivativeId = result.rows[0]?.derivativeId;
        if (derivativeId) {
          derivativeIds.push(derivativeId);
        }
      }
      return derivativeIds;
    },
    async failExhausted(derivativeId) {
      return booleanResult(
        await database.execute<{ readonly failed: boolean }>(sql`
          select littlearc.fail_exhausted_file_preview(${derivativeId}) as failed
        `),
        "failed",
      );
    },
    async fail(derivativeId, attemptId, safeErrorCode) {
      return booleanResult(
        await database.execute<{ readonly failed: boolean }>(sql`
          select littlearc.fail_file_preview(
            ${derivativeId}, ${attemptId}, ${safeErrorCode}
          ) as failed
        `),
        "failed",
      );
    },
    async finishDispatch(eventId, succeeded) {
      await database.execute(
        sql`select littlearc.finish_file_preview_outbox(${eventId}, ${succeeded})`,
      );
    },
    async heartbeat(derivativeId, attemptId, leaseSeconds) {
      return booleanResult(
        await database.execute<{ readonly maintained: boolean }>(sql`
          select littlearc.heartbeat_file_preview(
            ${derivativeId}, ${attemptId}, ${leaseSeconds}
          ) as maintained
        `),
        "maintained",
      );
    },
    async listStale(batchSize) {
      const result = await database.execute<{
        readonly attemptId: UuidV7;
        readonly derivativeId: UuidV7;
        readonly storageKey: string | null;
      }>(sql`
        select derivative_id as "derivativeId", attempt_id as "attemptId",
          storage_key as "storageKey"
        from littlearc.list_stale_file_preview_attempts(${batchSize})
      `);
      return result.rows;
    },
    async propose(derivativeId, attemptId, result) {
      return booleanResult(
        await database.execute<{ readonly proposed: boolean }>(sql`
          select littlearc.propose_file_preview_result(
            ${derivativeId}, ${attemptId}, ${result.storageKey},
            ${result.ciphertextBytes}, ${result.ciphertextSha256},
            ${result.wrappedFileKey}, ${result.wrapNonce}, ${result.contentNonce},
            ${result.authTag}, ${result.keyVersion}, ${result.pixelWidth},
            ${result.pixelHeight}
          ) as proposed
        `),
        "proposed",
      );
    },
    async recover(derivativeId, attemptId) {
      return booleanResult(
        await database.execute<{ readonly recovered: boolean }>(sql`
          select littlearc.recover_stale_file_preview(${derivativeId}, ${attemptId}) as recovered
        `),
        "recovered",
      );
    },
    async retry(derivativeId, attemptId, safeErrorCode) {
      return booleanResult(
        await database.execute<{ readonly retried: boolean }>(sql`
          select littlearc.retry_file_preview(
            ${derivativeId}, ${attemptId}, ${safeErrorCode}
          ) as retried
        `),
        "retried",
      );
    },
  };
}

export type FilePreviewGrant = {
  readonly aadVersion: 1;
  readonly authTag: Buffer;
  readonly ciphertextBytes: number;
  readonly ciphertextSha256: string;
  readonly contentNonce: Buffer;
  readonly derivativeId: UuidV7;
  readonly fileKey: Buffer;
  readonly policyVersion: 1;
  readonly sourceFileObjectId: UuidV7;
  readonly storageKey: string;
};

export type FilePreviewGrantPersistence = ReturnType<typeof createFilePreviewGrantPersistence>;

export function createFilePreviewGrantPersistence(options: {
  readonly crypto: StructuredPayloadCrypto;
  readonly database: DatabaseClient;
  readonly fileKeyCrypto: FileKeyCrypto;
}) {
  return {
    read: (input: {
      readonly deviceId: UuidV7;
      readonly fileObjectId: UuidV7;
      readonly identityUserId: string;
      readonly requestId: UuidV7;
    }): Promise<FilePreviewGrant | null> =>
      options.database.transaction(async (transaction) => {
        const context = await establishContext(transaction, input.identityUserId);
        requireCapability(context, "viewSelectedHealthRecords");
        await requireActiveDevice(transaction, context, input.deviceId);
        const result = await transaction.execute<{
          readonly aadVersion: 1;
          readonly authTag: Buffer;
          readonly ciphertextBytes: number;
          readonly ciphertextSha256: string;
          readonly contentNonce: Buffer;
          readonly derivativeId: UuidV7;
          readonly householdId: UuidV7;
          readonly keyVersion: number;
          readonly policyVersion: 1;
          readonly sourceFileObjectId: UuidV7;
          readonly storageKey: string;
          readonly wrappedFileKey: Buffer;
          readonly wrapNonce: Buffer;
        }>(sql`
          select derivative_id as "derivativeId",
            source_file_object_id as "sourceFileObjectId",
            household_id as "householdId", storage_key as "storageKey",
            ciphertext_bytes as "ciphertextBytes",
            ciphertext_sha256 as "ciphertextSha256",
            wrapped_file_key as "wrappedFileKey", wrap_nonce as "wrapNonce",
            content_nonce as "contentNonce", auth_tag as "authTag",
            key_version as "keyVersion", aad_version as "aadVersion",
            policy_version as "policyVersion"
          from littlearc.read_file_preview_grant(${input.fileObjectId}, ${input.deviceId})
        `);
        const derivative = result.rows[0];
        if (!derivative) {
          return null;
        }
        const wrappedHouseholdKey = await readHouseholdKey(transaction, context.householdId);
        const householdKey = options.crypto.unwrapHouseholdKey(wrappedHouseholdKey);
        try {
          const fileKey = options.fileKeyCrypto.unwrap(
            {
              keyVersion: derivative.keyVersion,
              wrapNonce: derivative.wrapNonce,
              wrappedKey: derivative.wrappedFileKey,
            },
            householdKey,
            {
              aadSchemaVersion: 1,
              derivativeId: derivative.derivativeId,
              format: "image/jpeg",
              previewPolicyVersion: 1,
              purpose: "validation-preview",
              sourceObjectId: derivative.sourceFileObjectId,
            },
          );
          await transaction.execute(sql`
            insert into littlearc.audit_events (
              id, household_id, actor_id, actor_role, action, target_type,
              target_id, request_id, result, metadata
            ) values (
              ${input.requestId}, ${context.householdId}, ${context.membershipId},
              ${context.role}, 'file_preview_download_authorized', 'file_derivative',
              ${derivative.derivativeId}, ${input.requestId}, 'success', '{}'::jsonb
            )
          `);
          return {
            aadVersion: derivative.aadVersion,
            authTag: derivative.authTag,
            ciphertextBytes: derivative.ciphertextBytes,
            ciphertextSha256: derivative.ciphertextSha256,
            contentNonce: derivative.contentNonce,
            derivativeId: derivative.derivativeId,
            fileKey,
            policyVersion: derivative.policyVersion,
            sourceFileObjectId: derivative.sourceFileObjectId,
            storageKey: derivative.storageKey,
          };
        } finally {
          householdKey.fill(0);
        }
      }),
  };
}

type Context = {
  readonly grantedCapabilities: ReadonlySet<HouseholdCapability>;
  readonly householdId: UuidV7;
  readonly membershipId: UuidV7;
  readonly role: HouseholdRole;
};

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
    select set_config('littlearc.current_household_id', ${context.householdId}, true),
      set_config('littlearc.current_actor_id', ${context.membershipId}, true),
      set_config('littlearc.current_actor_role', ${context.role}, true),
      set_config('littlearc.current_identity_user_id', ${identityUserId}, true)
  `);
  const capabilities = await transaction.execute<{ readonly capability: HouseholdCapability }>(sql`
    select capability from littlearc.membership_capabilities
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

async function requireActiveDevice(
  transaction: SqlTransaction,
  context: Context,
  deviceId: UuidV7,
): Promise<void> {
  const result = await transaction.execute(sql`
    select 1 from littlearc.devices
    where household_id = ${context.householdId}
      and id = ${deviceId}
      and user_id = current_setting('littlearc.current_identity_user_id', true)
      and enrollment_status = 'active'
      and revoked_at is null
  `);
  if (result.rowCount !== 1) {
    throw new FileUploadPersistenceError(
      "device_required",
      "An active enrolled device is required.",
    );
  }
}

async function readHouseholdKey(
  transaction: SqlTransaction,
  householdId: UuidV7,
): Promise<WrappedHouseholdKey> {
  const result = await transaction.execute<WrappedHouseholdKey>(sql`
    select key_version as "keyVersion", wrap_nonce as "wrapNonce",
      wrapped_key as "wrappedKey", wrapping_key_version as "wrappingKeyVersion"
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

function booleanResult<Key extends string>(
  result: { readonly rows: ReadonlyArray<Record<Key, boolean>> },
  key: Key,
): boolean {
  return result.rows[0]?.[key] === true;
}

import { randomBytes } from "node:crypto";

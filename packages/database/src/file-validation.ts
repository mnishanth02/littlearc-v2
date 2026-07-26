import type { WrappedHouseholdKey } from "@littlearc/crypto";
import type { FileMalwareState, FileValidationSafeErrorCode, UuidV7 } from "@littlearc/domain";
import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./client.js";

export type FileValidationDispatch = {
  readonly eventId: UuidV7;
  readonly fileObjectId: UuidV7;
};

export type ClaimedFileValidation = {
  readonly aadVersion: 1;
  readonly authTag: Buffer;
  readonly ciphertextBytes: number;
  readonly ciphertextSha256: string;
  readonly contentNonce: Buffer;
  readonly declaredMime: "application/pdf" | "image/heic" | "image/jpeg" | "image/png";
  readonly fileKeyVersion: number;
  readonly fileObjectId: UuidV7;
  readonly fileWrapNonce: Buffer;
  readonly householdId: UuidV7;
  readonly householdKey: WrappedHouseholdKey;
  readonly objectKey: string;
  readonly wrappedFileKey: Buffer;
};

export type FileValidationPersistence = {
  readonly claim: (
    fileObjectId: UuidV7,
    attemptId: UuidV7,
    leaseSeconds: number,
  ) => Promise<ClaimedFileValidation | null>;
  readonly claimDispatches: (batchSize: number) => Promise<ReadonlyArray<FileValidationDispatch>>;
  readonly commit: (
    fileObjectId: UuidV7,
    attemptId: UuidV7,
    terminalState: "failed" | "ready" | "rejected",
  ) => Promise<boolean>;
  readonly finishDispatch: (eventId: UuidV7, succeeded: boolean) => Promise<void>;
  readonly failExhausted: (fileObjectId: UuidV7) => Promise<boolean>;
  readonly heartbeat: (
    fileObjectId: UuidV7,
    attemptId: UuidV7,
    leaseSeconds: number,
  ) => Promise<boolean>;
  readonly listStale: (
    batchSize: number,
  ) => Promise<ReadonlyArray<{ readonly attemptId: UuidV7; readonly fileObjectId: UuidV7 }>>;
  readonly propose: (
    fileObjectId: UuidV7,
    attemptId: UuidV7,
    result: {
      readonly detectedMime: ClaimedFileValidation["declaredMime"] | null;
      readonly malwareState: FileMalwareState;
      readonly pageCount: number | null;
      readonly policyVersion: number;
      readonly safeErrorCode: FileValidationSafeErrorCode | null;
      readonly terminalState: "failed" | "ready" | "rejected";
    },
  ) => Promise<boolean>;
  readonly recover: (fileObjectId: UuidV7, attemptId: UuidV7) => Promise<boolean>;
  readonly retry: (
    fileObjectId: UuidV7,
    attemptId: UuidV7,
    safeErrorCode: FileValidationSafeErrorCode,
  ) => Promise<boolean>;
};

type ClaimRow = Omit<ClaimedFileValidation, "householdKey"> & {
  readonly householdKeyVersion: number;
  readonly householdWrapNonce: Buffer;
  readonly householdWrappingKeyVersion: number;
  readonly wrappedHouseholdKey: Buffer;
};

export function createFileValidationPersistence(
  database: DatabaseClient,
): FileValidationPersistence {
  return {
    async claim(fileObjectId, attemptId, leaseSeconds) {
      const result = await database.execute<ClaimRow>(sql`
        select * from littlearc.claim_file_validation(
          ${fileObjectId}, ${attemptId}, ${leaseSeconds}
        )
      `);
      const row = result.rows[0];
      if (!row) {
        return null;
      }
      return {
        aadVersion: row.aadVersion,
        authTag: row.authTag,
        ciphertextBytes: row.ciphertextBytes,
        ciphertextSha256: row.ciphertextSha256,
        contentNonce: row.contentNonce,
        declaredMime: row.declaredMime,
        fileKeyVersion: row.fileKeyVersion,
        fileObjectId: row.fileObjectId,
        fileWrapNonce: row.fileWrapNonce,
        householdId: row.householdId,
        householdKey: {
          keyVersion: row.householdKeyVersion,
          wrapNonce: row.householdWrapNonce,
          wrappedKey: row.wrappedHouseholdKey,
          wrappingKeyVersion: row.householdWrappingKeyVersion,
        },
        objectKey: row.objectKey,
        wrappedFileKey: row.wrappedFileKey,
      };
    },
    async claimDispatches(batchSize) {
      const result = await database.execute<FileValidationDispatch>(sql`
        select
          event_id as "eventId",
          file_object_id as "fileObjectId"
        from littlearc.claim_file_validation_outbox(${batchSize})
      `);
      return result.rows;
    },
    async commit(fileObjectId, attemptId, terminalState) {
      return booleanResult(
        await database.execute<{ readonly committed: boolean }>(sql`
          select littlearc.commit_file_validation_result(
            ${fileObjectId}, ${attemptId}, ${terminalState}
          ) as committed
        `),
        "committed",
      );
    },
    async finishDispatch(eventId, succeeded) {
      await database.execute(
        sql`select littlearc.finish_file_validation_outbox(${eventId}, ${succeeded})`,
      );
    },
    async failExhausted(fileObjectId) {
      return booleanResult(
        await database.execute<{ readonly failed: boolean }>(sql`
          select littlearc.fail_exhausted_file_validation(${fileObjectId}) as failed
        `),
        "failed",
      );
    },
    async heartbeat(fileObjectId, attemptId, leaseSeconds) {
      return booleanResult(
        await database.execute<{ readonly heartbeated: boolean }>(sql`
          select littlearc.heartbeat_file_validation(
            ${fileObjectId}, ${attemptId}, ${leaseSeconds}
          ) as heartbeated
        `),
        "heartbeated",
      );
    },
    async listStale(batchSize) {
      const result = await database.execute<{
        readonly attemptId: UuidV7;
        readonly fileObjectId: UuidV7;
      }>(sql`
        select
          file_object_id as "fileObjectId",
          attempt_id as "attemptId"
        from littlearc.list_stale_file_validation_attempts(${batchSize})
      `);
      return result.rows;
    },
    async propose(fileObjectId, attemptId, result) {
      return booleanResult(
        await database.execute<{ readonly proposed: boolean }>(sql`
          select littlearc.propose_file_validation_result(
            ${fileObjectId},
            ${attemptId},
            ${result.terminalState},
            ${result.malwareState},
            ${result.detectedMime},
            ${result.pageCount},
            ${result.safeErrorCode},
            ${result.policyVersion}
          ) as proposed
        `),
        "proposed",
      );
    },
    async recover(fileObjectId, attemptId) {
      return booleanResult(
        await database.execute<{ readonly recovered: boolean }>(sql`
          select littlearc.recover_stale_file_validation(
            ${fileObjectId}, ${attemptId}
          ) as recovered
        `),
        "recovered",
      );
    },
    async retry(fileObjectId, attemptId, safeErrorCode) {
      return booleanResult(
        await database.execute<{ readonly retried: boolean }>(sql`
          select littlearc.retry_file_validation(
            ${fileObjectId}, ${attemptId}, ${safeErrorCode}
          ) as retried
        `),
        "retried",
      );
    },
  };
}

function booleanResult<Key extends string>(
  result: { readonly rows: ReadonlyArray<Record<Key, boolean>> },
  key: Key,
): boolean {
  return result.rows[0]?.[key] === true;
}

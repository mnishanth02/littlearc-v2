import type { UuidV7 } from "@littlearc/domain";
import { sql } from "drizzle-orm";
import type { DatabaseClient } from "./client.js";

export type ExpiredUploadClaim = {
  readonly objectKey: string;
  readonly providerUploadId: string;
  readonly sessionId: UuidV7;
};

export type UploadCleanupPersistence = {
  readonly claim: (batchSize: number) => Promise<ReadonlyArray<ExpiredUploadClaim>>;
  readonly finish: (sessionId: UuidV7, succeeded: boolean) => Promise<void>;
};

export function createUploadCleanupPersistence(database: DatabaseClient): UploadCleanupPersistence {
  return {
    claim: (batchSize) =>
      database.transaction(async (transaction) => {
        await transaction.execute(sql`set local role littlearc_worker`);
        const result = await transaction.execute<ExpiredUploadClaim>(sql`
          select
            session_id as "sessionId",
            object_key as "objectKey",
            provider_upload_id as "providerUploadId"
          from littlearc.claim_expired_upload_sessions(${batchSize})
        `);
        return result.rows;
      }),
    finish: (sessionId, succeeded) =>
      database.transaction(async (transaction) => {
        await transaction.execute(sql`set local role littlearc_worker`);
        await transaction.execute(
          sql`select littlearc.finish_expired_upload_session(${sessionId}, ${succeeded})`,
        );
      }),
  };
}

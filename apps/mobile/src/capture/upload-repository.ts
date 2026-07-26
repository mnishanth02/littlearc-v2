import type { LocalSyncDatabase } from "../sync/repository";
import type { CaptureMimeType } from "./policy";

export type LocalUploadPart = {
  readonly byteCount: number;
  readonly etag: string;
  readonly partNumber: number;
  readonly uploadedAt: string;
};

export type LocalUploadState =
  | "cancelled"
  | "completing"
  | "created"
  | "expired"
  | "failed"
  | "uploaded"
  | "uploading";

export type LocalUploadSession = {
  readonly captureAssetId: string;
  readonly childId: string;
  readonly expectedCiphertextBytes: number;
  readonly expectedCiphertextSha256: string;
  readonly expiresAt: string | null;
  readonly fileObjectId: string;
  readonly localFileId: string;
  readonly parts: ReadonlyArray<LocalUploadPart>;
  readonly safeErrorCode: string | null;
  readonly sessionId: string;
  readonly state: LocalUploadState;
  readonly updatedAt: string;
};

export type CaptureUploadContext = {
  readonly assetId: string;
  readonly childId: string;
  readonly declaredMime: CaptureMimeType;
  readonly deviceId: string;
  readonly fileObjectId: string;
  readonly householdId: string;
  readonly localFileId: string;
};

type LocalUploadSessionRow = Omit<LocalUploadSession, "parts">;

export async function readCaptureUploadContext(
  database: LocalSyncDatabase,
  assetId: string,
): Promise<CaptureUploadContext | null> {
  return database.getFirstAsync<CaptureUploadContext>(
    `select
       asset.asset_id as "assetId",
       draft.child_id as "childId",
       asset.detected_mime as "declaredMime",
       enrollment.device_id as "deviceId",
       asset.original_file_id as "fileObjectId",
       enrollment.household_id as "householdId",
       asset.original_file_id as "localFileId"
     from local_capture_assets asset
     join local_capture_drafts draft on draft.draft_id = asset.draft_id
     join local_enrollment enrollment on enrollment.singleton = 1
     where asset.asset_id = ?`,
    assetId,
  );
}

export async function readLocalUploadSession(
  database: LocalSyncDatabase,
  captureAssetId: string,
): Promise<LocalUploadSession | null> {
  const row = await database.getFirstAsync<LocalUploadSessionRow>(
    `select
       session_id as "sessionId",
       file_object_id as "fileObjectId",
       capture_asset_id as "captureAssetId",
       child_id as "childId",
       local_file_id as "localFileId",
       state,
       safe_error_code as "safeErrorCode",
       expected_ciphertext_bytes as "expectedCiphertextBytes",
       expected_ciphertext_sha256 as "expectedCiphertextSha256",
       expires_at as "expiresAt",
       updated_at as "updatedAt"
     from local_upload_sessions
     where capture_asset_id = ?`,
    captureAssetId,
  );
  if (!row) {
    return null;
  }
  return { ...row, parts: await listLocalUploadParts(database, row.sessionId) };
}

export async function beginLocalUpload(
  database: LocalSyncDatabase,
  input: Omit<LocalUploadSession, "parts" | "safeErrorCode" | "state">,
): Promise<void> {
  await database.runAsync(
    `insert into local_upload_sessions (
       session_id, file_object_id, capture_asset_id, child_id, local_file_id,
       state, safe_error_code, expected_ciphertext_bytes,
       expected_ciphertext_sha256, expires_at, updated_at
     ) values (?, ?, ?, ?, ?, 'created', null, ?, ?, ?, ?)
     on conflict(file_object_id) do nothing`,
    input.sessionId,
    input.fileObjectId,
    input.captureAssetId,
    input.childId,
    input.localFileId,
    input.expectedCiphertextBytes,
    input.expectedCiphertextSha256,
    input.expiresAt,
    input.updatedAt,
  );
}

export async function replaceLocalUploadParts(
  database: LocalSyncDatabase,
  sessionId: string,
  parts: ReadonlyArray<LocalUploadPart>,
): Promise<void> {
  await database.withTransactionAsync(async () => {
    await database.runAsync("delete from local_upload_parts where session_id = ?", sessionId);
    for (const part of parts) {
      await upsertLocalUploadPart(database, sessionId, part);
    }
  });
}

export async function upsertLocalUploadPart(
  database: LocalSyncDatabase,
  sessionId: string,
  part: LocalUploadPart,
): Promise<void> {
  await database.runAsync(
    `insert into local_upload_parts (
       session_id, part_number, etag, byte_count, uploaded_at
     ) values (?, ?, ?, ?, ?)
     on conflict(session_id, part_number) do update set
       etag = excluded.etag,
       byte_count = excluded.byte_count,
       uploaded_at = excluded.uploaded_at`,
    sessionId,
    part.partNumber,
    part.etag,
    part.byteCount,
    part.uploadedAt,
  );
}

export async function setLocalUploadState(
  database: LocalSyncDatabase,
  input: {
    readonly expiresAt?: string | null;
    readonly safeErrorCode: string | null;
    readonly sessionId: string;
    readonly state: LocalUploadState;
    readonly updatedAt: string;
  },
): Promise<void> {
  await database.runAsync(
    `update local_upload_sessions
     set state = ?, safe_error_code = ?,
         expires_at = coalesce(?, expires_at), updated_at = ?
     where session_id = ?`,
    input.state,
    input.safeErrorCode,
    input.expiresAt ?? null,
    input.updatedAt,
    input.sessionId,
  );
}

async function listLocalUploadParts(
  database: LocalSyncDatabase,
  sessionId: string,
): Promise<ReadonlyArray<LocalUploadPart>> {
  return database.getAllAsync<LocalUploadPart>(
    `select
       part_number as "partNumber",
       etag,
       byte_count as "byteCount",
       uploaded_at as "uploadedAt"
     from local_upload_parts
     where session_id = ?
     order by part_number`,
    sessionId,
  );
}

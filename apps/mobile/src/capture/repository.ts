import type { LocalSyncDatabase } from "../sync/repository";
import type { CaptureMimeType, CaptureSafeErrorCode, CaptureSourceKind } from "./policy";

export type LocalCaptureAsset = {
  readonly assetId: string;
  readonly byteCount: number;
  readonly createdAt: string;
  readonly detectedMime: CaptureMimeType;
  readonly displayOrder: number;
  readonly draftId: string;
  readonly height: number | null;
  readonly normalizedFileId: string | null;
  readonly originalFileId: string;
  readonly pageCount: number;
  readonly sourceKind: CaptureSourceKind;
  readonly thumbnailFileId: string;
  readonly width: number | null;
};

export type LocalCaptureDraft = {
  readonly assets: ReadonlyArray<LocalCaptureAsset>;
  readonly childId: string;
  readonly createdAt: string;
  readonly draftId: string;
  readonly safeErrorCode: CaptureSafeErrorCode | null;
  readonly state: "editing" | "processing";
  readonly updatedAt: string;
};

type CaptureDraftRow = Omit<LocalCaptureDraft, "assets">;

export async function createCaptureDraft(
  database: LocalSyncDatabase,
  input: {
    readonly childId: string;
    readonly createdAt: string;
    readonly draftId: string;
  },
): Promise<void> {
  await database.runAsync(
    `insert into local_capture_drafts (
      draft_id, child_id, state, safe_error_code, created_at, updated_at
    ) values (?, ?, 'editing', null, ?, ?)
    on conflict(draft_id) do nothing`,
    input.draftId,
    input.childId,
    input.createdAt,
    input.createdAt,
  );
}

export async function readCaptureDraft(
  database: LocalSyncDatabase,
  draftId: string,
): Promise<LocalCaptureDraft | null> {
  const draft = await database.getFirstAsync<CaptureDraftRow>(
    `select
      draft_id as "draftId",
      child_id as "childId",
      state,
      safe_error_code as "safeErrorCode",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from local_capture_drafts
    where draft_id = ?`,
    draftId,
  );
  if (!draft) {
    return null;
  }
  return { ...draft, assets: await listCaptureAssets(database, draftId) };
}

export async function listCaptureDrafts(
  database: LocalSyncDatabase,
  childId: string,
): Promise<ReadonlyArray<LocalCaptureDraft>> {
  const rows = await database.getAllAsync<CaptureDraftRow>(
    `select
      draft_id as "draftId",
      child_id as "childId",
      state,
      safe_error_code as "safeErrorCode",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from local_capture_drafts
    where child_id = ?
    order by updated_at desc, draft_id desc`,
    childId,
  );
  return Promise.all(
    rows.map(async (row) => ({ ...row, assets: await listCaptureAssets(database, row.draftId) })),
  );
}

export async function appendCaptureAsset(
  database: LocalSyncDatabase,
  input: LocalCaptureAsset,
): Promise<void> {
  await database.withTransactionAsync(async () => {
    const draft = await database.getFirstAsync<{ readonly draftId: string }>(
      `select draft_id as "draftId" from local_capture_drafts where draft_id = ?`,
      input.draftId,
    );
    if (!draft) {
      throw new Error("The capture draft is unavailable.");
    }
    await database.runAsync(
      `insert into local_capture_assets (
        asset_id, draft_id, source_kind, display_order, detected_mime,
        original_bytes, page_count, width, height, original_file_id,
        normalized_file_id, thumbnail_file_id, created_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.assetId,
      input.draftId,
      input.sourceKind,
      input.displayOrder,
      input.detectedMime,
      input.byteCount,
      input.pageCount,
      input.width,
      input.height,
      input.originalFileId,
      input.normalizedFileId,
      input.thumbnailFileId,
      input.createdAt,
    );
    await database.runAsync(
      `update local_capture_drafts
       set state = 'editing', safe_error_code = null, updated_at = ?
       where draft_id = ?`,
      input.createdAt,
      input.draftId,
    );
  });
}

export async function setCaptureDraftState(
  database: LocalSyncDatabase,
  input: {
    readonly draftId: string;
    readonly safeErrorCode: CaptureSafeErrorCode | null;
    readonly state: "editing" | "processing";
    readonly updatedAt: string;
  },
): Promise<void> {
  await database.runAsync(
    `update local_capture_drafts
     set state = ?, safe_error_code = ?, updated_at = ?
     where draft_id = ?`,
    input.state,
    input.safeErrorCode,
    input.updatedAt,
    input.draftId,
  );
}

export async function deleteCaptureDraftMetadata(
  database: LocalSyncDatabase,
  draftId: string,
): Promise<void> {
  await database.runAsync("delete from local_capture_drafts where draft_id = ?", draftId);
}

async function listCaptureAssets(
  database: LocalSyncDatabase,
  draftId: string,
): Promise<ReadonlyArray<LocalCaptureAsset>> {
  return database.getAllAsync<LocalCaptureAsset>(
    `select
      asset_id as "assetId",
      draft_id as "draftId",
      source_kind as "sourceKind",
      display_order as "displayOrder",
      detected_mime as "detectedMime",
      original_bytes as "byteCount",
      page_count as "pageCount",
      width,
      height,
      original_file_id as "originalFileId",
      normalized_file_id as "normalizedFileId",
      thumbnail_file_id as "thumbnailFileId",
      created_at as "createdAt"
    from local_capture_assets
    where draft_id = ?
    order by display_order, asset_id`,
    draftId,
  );
}

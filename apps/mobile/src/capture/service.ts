import { createUuidV7 } from "@littlearc/domain";
import { getRandomBytes } from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import {
  deleteEncryptedLocalFile,
  deleteEncryptedLocalFileMaterial,
  deleteEncryptedLocalFileMetadata,
  storeEncryptedLocalFile,
  withUnlockedLocalDatabase,
} from "../local-security/native";
import { CaptureProcessingError, processCaptureSource } from "./native-processor";
import {
  type CaptureSafeErrorCode,
  type CaptureSourceKind,
  maximumCapturePages,
  maximumThumbnailDimension,
  validateCaptureInspection,
} from "./policy";
import {
  appendCaptureAsset,
  createCaptureDraft,
  deleteCaptureDraftMetadata,
  type LocalCaptureDraft,
  readCaptureDraft,
  setCaptureDraftState,
} from "./repository";

export async function createOrReadCaptureDraft(input: {
  readonly childId: string;
  readonly draftId: string;
}): Promise<LocalCaptureDraft> {
  return withUnlockedLocalDatabase(async (database) => {
    const existing = await readCaptureDraft(database, input.draftId);
    if (existing) {
      if (existing.state === "processing") {
        await setCaptureDraftState(database, {
          draftId: input.draftId,
          safeErrorCode: "capture_processing_failed",
          state: "editing",
          updatedAt: new Date().toISOString(),
        });
        return requireCaptureDraft(database, input.draftId);
      }
      return existing;
    }
    const now = new Date().toISOString();
    await createCaptureDraft(database, {
      childId: input.childId,
      createdAt: now,
      draftId: input.draftId,
    });
    return requireCaptureDraft(database, input.draftId);
  });
}

export async function addSourcesToCaptureDraft(input: {
  readonly draftId: string;
  readonly sourceKind: CaptureSourceKind;
  readonly uris: ReadonlyArray<string>;
}): Promise<LocalCaptureDraft> {
  let draft = await withUnlockedLocalDatabase((database) =>
    requireCaptureDraft(database, input.draftId),
  );
  for (const uri of input.uris) {
    const staging = new Directory(Paths.cache, "littlearc-capture-staging-v1", input.draftId);
    staging.create({ idempotent: true, intermediates: true });
    const assetId = opaqueId();
    const stagedUris: string[] = [];
    let encryptedFileIds: string[] = [];
    try {
      await withUnlockedLocalDatabase((database) =>
        setCaptureDraftState(database, {
          draftId: input.draftId,
          safeErrorCode: null,
          state: "processing",
          updatedAt: new Date().toISOString(),
        }),
      );
      const processed = await processCaptureSource({
        opaqueBaseName: assetId,
        outputDirectoryUri: staging.uri,
        sourceUri: uri,
        thumbnailDimension: maximumThumbnailDimension,
      });
      stagedUris.push(
        processed.originalUri,
        processed.thumbnailUri,
        ...(processed.normalizedUri ? [processed.normalizedUri] : []),
      );
      const existingPages = draft.assets.reduce((sum, asset) => sum + asset.pageCount, 0);
      const validation = validateCaptureInspection(processed, existingPages);
      if (!validation.accepted) {
        throw new CaptureProcessingError(validation.code);
      }
      if (existingPages + processed.pageCount > maximumCapturePages) {
        throw new CaptureProcessingError("capture_page_limit");
      }
      const originalFileId = opaqueId();
      const normalizedFileId = processed.normalizedUri ? opaqueId() : null;
      const thumbnailFileId = opaqueId();
      encryptedFileIds = [
        originalFileId,
        ...(normalizedFileId ? [normalizedFileId] : []),
        thumbnailFileId,
      ];
      await withUnlockedLocalDatabase(async (database) => {
        await storeEncryptedLocalFile(database, {
          fileId: originalFileId,
          plaintextUri: processed.originalUri,
          purpose: "capture-original",
        });
        if (normalizedFileId && processed.normalizedUri) {
          await storeEncryptedLocalFile(database, {
            fileId: normalizedFileId,
            plaintextUri: processed.normalizedUri,
            purpose: "capture-normalized",
          });
        }
        await storeEncryptedLocalFile(database, {
          fileId: thumbnailFileId,
          plaintextUri: processed.thumbnailUri,
          purpose: "capture-thumbnail",
        });
        await appendCaptureAsset(database, {
          assetId,
          byteCount: processed.byteCount,
          createdAt: new Date().toISOString(),
          detectedMime: processed.mimeType,
          displayOrder: draft.assets.length,
          draftId: input.draftId,
          height: processed.height,
          normalizedFileId,
          originalFileId,
          pageCount: processed.pageCount,
          sourceKind: input.sourceKind,
          thumbnailFileId,
          width: processed.width,
        });
      });
      encryptedFileIds = [];
      draft = await withUnlockedLocalDatabase((database) =>
        requireCaptureDraft(database, input.draftId),
      );
    } catch (error) {
      const code =
        error instanceof CaptureProcessingError ? error.code : "capture_processing_failed";
      await cleanupEncryptedFiles(encryptedFileIds);
      await withUnlockedLocalDatabase((database) =>
        setCaptureDraftState(database, {
          draftId: input.draftId,
          safeErrorCode: code,
          state: "editing",
          updatedAt: new Date().toISOString(),
        }),
      );
      throw error instanceof CaptureProcessingError
        ? error
        : new CaptureProcessingError(code, { cause: error });
    } finally {
      for (const stagedUri of stagedUris) {
        deleteIfPresent(stagedUri);
      }
      deleteOwnedPickerCopy(uri);
      if (staging.exists) {
        staging.delete();
      }
    }
  }
  return draft;
}

export async function discardCaptureDraft(draftId: string): Promise<void> {
  await withUnlockedLocalDatabase(async (database) => {
    const draft = await readCaptureDraft(database, draftId);
    if (!draft) {
      return;
    }
    const fileIds = draft.assets.flatMap((asset) => [
      asset.originalFileId,
      ...(asset.normalizedFileId ? [asset.normalizedFileId] : []),
      asset.thumbnailFileId,
    ]);
    for (const fileId of fileIds) {
      await deleteEncryptedLocalFileMaterial(database, fileId);
    }
    await database.withTransactionAsync(async () => {
      await deleteCaptureDraftMetadata(database, draftId);
      for (const fileId of fileIds) {
        await deleteEncryptedLocalFileMetadata(database, fileId);
      }
    });
  });
}

async function cleanupEncryptedFiles(fileIds: ReadonlyArray<string>): Promise<void> {
  if (fileIds.length === 0) {
    return;
  }
  await withUnlockedLocalDatabase(async (database) => {
    for (const fileId of fileIds) {
      await deleteEncryptedLocalFile(database, fileId);
    }
  });
}

async function requireCaptureDraft(
  database: Parameters<typeof readCaptureDraft>[0],
  draftId: string,
): Promise<LocalCaptureDraft> {
  const draft = await readCaptureDraft(database, draftId);
  if (!draft) {
    throw new Error("The capture draft is unavailable.");
  }
  return draft;
}

function opaqueId(): string {
  return createUuidV7(getRandomBytes(10));
}

function deleteOwnedPickerCopy(uri: string): void {
  if (uri.startsWith(Paths.cache.uri)) {
    deleteIfPresent(uri);
  }
}

function deleteIfPresent(uri: string): void {
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}

export function captureSafeCode(error: unknown): CaptureSafeErrorCode {
  return error instanceof CaptureProcessingError ? error.code : "capture_processing_failed";
}

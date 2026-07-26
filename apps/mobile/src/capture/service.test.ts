import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const events: string[] = [];
  const database = {
    withTransactionAsync: vi.fn(async (action: () => Promise<void>) => {
      events.push("transaction:start");
      await action();
      events.push("transaction:end");
    }),
  };
  return {
    database,
    deleteCaptureDraftMetadata: vi.fn(async () => {
      events.push("draft:delete");
    }),
    deleteEncryptedLocalFile: vi.fn(),
    deleteEncryptedLocalFileMaterial: vi.fn(async (_database, fileId: string) => {
      events.push(`material:${fileId}`);
    }),
    deleteEncryptedLocalFileMetadata: vi.fn(async (_database, fileId: string) => {
      events.push(`metadata:${fileId}`);
    }),
    events,
    readCaptureDraft: vi.fn(),
    withUnlockedLocalDatabase: vi.fn(async (action) => action(database)),
  };
});

vi.mock("@littlearc/domain", () => ({ createUuidV7: vi.fn() }));
vi.mock("expo-crypto", () => ({ getRandomBytes: vi.fn() }));
vi.mock("expo-file-system", () => ({
  Directory: vi.fn(),
  File: vi.fn(),
  Paths: { cache: { uri: "file:///cache/" } },
}));
vi.mock("../local-security/native", () => ({
  deleteEncryptedLocalFile: mocks.deleteEncryptedLocalFile,
  deleteEncryptedLocalFileMaterial: mocks.deleteEncryptedLocalFileMaterial,
  deleteEncryptedLocalFileMetadata: mocks.deleteEncryptedLocalFileMetadata,
  storeEncryptedLocalFile: vi.fn(),
  withUnlockedLocalDatabase: mocks.withUnlockedLocalDatabase,
}));
vi.mock("./native-processor", () => ({
  CaptureProcessingError: class CaptureProcessingError extends Error {},
  processCaptureSource: vi.fn(),
}));
vi.mock("./repository", () => ({
  appendCaptureAsset: vi.fn(),
  createCaptureDraft: vi.fn(),
  deleteCaptureDraftMetadata: mocks.deleteCaptureDraftMetadata,
  readCaptureDraft: mocks.readCaptureDraft,
  setCaptureDraftState: vi.fn(),
}));

import { discardCaptureDraft } from "./service";

describe("VLT-03 capture service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.events.length = 0;
    mocks.readCaptureDraft.mockResolvedValue({
      assets: [
        {
          normalizedFileId: "normalized-1",
          originalFileId: "original-1",
          thumbnailFileId: "thumbnail-1",
        },
        {
          normalizedFileId: null,
          originalFileId: "original-2",
          thumbnailFileId: "thumbnail-2",
        },
      ],
      draftId: "draft-1",
    });
  });

  it("removes protected material before atomically releasing capture references and metadata", async () => {
    await discardCaptureDraft("draft-1");

    expect(mocks.events).toEqual([
      "material:original-1",
      "material:normalized-1",
      "material:thumbnail-1",
      "material:original-2",
      "material:thumbnail-2",
      "transaction:start",
      "draft:delete",
      "metadata:original-1",
      "metadata:normalized-1",
      "metadata:thumbnail-1",
      "metadata:original-2",
      "metadata:thumbnail-2",
      "transaction:end",
    ]);
  });

  it("retains database recovery references when protected-material deletion fails", async () => {
    mocks.deleteEncryptedLocalFileMaterial.mockRejectedValueOnce(new Error("delete failed"));

    await expect(discardCaptureDraft("draft-1")).rejects.toThrow("delete failed");

    expect(mocks.database.withTransactionAsync).not.toHaveBeenCalled();
    expect(mocks.deleteCaptureDraftMetadata).not.toHaveBeenCalled();
    expect(mocks.deleteEncryptedLocalFileMetadata).not.toHaveBeenCalled();
  });
});

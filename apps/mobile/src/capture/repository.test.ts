import { describe, expect, it, vi } from "vitest";
import type { LocalSyncDatabase } from "../sync/repository";
import {
  appendCaptureAsset,
  createCaptureDraft,
  deleteCaptureDraftMetadata,
  readCaptureDraft,
  setCaptureDraftState,
} from "./repository";

function scriptedDatabase(input: {
  readonly all?: ReadonlyArray<unknown>;
  readonly first?: ReadonlyArray<unknown>;
}) {
  const all = [...(input.all ?? [])];
  const first = [...(input.first ?? [])];
  const runAsync = vi.fn(
    async (_sql: string, ..._params: Array<string | number | null>) => undefined,
  );
  const database: LocalSyncDatabase = {
    async getAllAsync<T>() {
      return (all.shift() ?? []) as ReadonlyArray<T>;
    },
    async getFirstAsync<T>() {
      return (first.shift() ?? null) as T | null;
    },
    runAsync,
    async withTransactionAsync(task) {
      await task();
    },
  };
  return { database, runAsync };
}

describe("VLT-03 capture repository", () => {
  it("creates an opaque resumable draft without record authority", async () => {
    const scripted = scriptedDatabase({});
    await createCaptureDraft(scripted.database, {
      childId: "019f742b-de82-7292-86cd-5475a1388313",
      createdAt: "2026-07-24T12:00:00.000Z",
      draftId: "019f742b-de82-7292-86cd-5475a1388314",
    });
    expect(String(scripted.runAsync.mock.calls[0]?.[0])).toContain("local_capture_drafts");
    expect(String(scripted.runAsync.mock.calls[0]?.[0])).not.toContain("local_records");
  });

  it("appends one encrypted asset and clears a prior safe error atomically", async () => {
    const scripted = scriptedDatabase({ first: [{ draftId: "draft" }] });
    await appendCaptureAsset(scripted.database, {
      assetId: "asset",
      byteCount: 1_024,
      createdAt: "2026-07-24T12:01:00.000Z",
      detectedMime: "image/jpeg",
      displayOrder: 0,
      draftId: "draft",
      height: 800,
      normalizedFileId: "normalized",
      originalFileId: "original",
      pageCount: 1,
      sourceKind: "camera",
      thumbnailFileId: "thumbnail",
      width: 600,
    });
    expect(scripted.runAsync).toHaveBeenCalledTimes(2);
    expect(String(scripted.runAsync.mock.calls[0]?.[0])).toContain("local_capture_assets");
    expect(String(scripted.runAsync.mock.calls[1]?.[0])).toContain("safe_error_code = null");
  });

  it("reopens ordered capture metadata after interruption", async () => {
    const scripted = scriptedDatabase({
      all: [
        [
          {
            assetId: "asset",
            byteCount: 1_024,
            createdAt: "2026-07-24T12:01:00.000Z",
            detectedMime: "application/pdf",
            displayOrder: 0,
            draftId: "draft",
            height: null,
            normalizedFileId: null,
            originalFileId: "original",
            pageCount: 2,
            sourceKind: "file",
            thumbnailFileId: "thumbnail",
            width: null,
          },
        ],
      ],
      first: [
        {
          childId: "child",
          createdAt: "2026-07-24T12:00:00.000Z",
          draftId: "draft",
          safeErrorCode: null,
          state: "editing",
          updatedAt: "2026-07-24T12:01:00.000Z",
        },
      ],
    });
    await expect(readCaptureDraft(scripted.database, "draft")).resolves.toMatchObject({
      assets: [{ pageCount: 2, sourceKind: "file" }],
      draftId: "draft",
    });
  });

  it("records safe failure state and deletes only capture metadata", async () => {
    const scripted = scriptedDatabase({});
    await setCaptureDraftState(scripted.database, {
      draftId: "draft",
      safeErrorCode: "capture_unsupported_type",
      state: "editing",
      updatedAt: "2026-07-24T12:02:00.000Z",
    });
    await deleteCaptureDraftMetadata(scripted.database, "draft");
    expect(scripted.runAsync).toHaveBeenCalledTimes(2);
    expect(String(scripted.runAsync.mock.calls[1]?.[0])).toBe(
      "delete from local_capture_drafts where draft_id = ?",
    );
  });
});

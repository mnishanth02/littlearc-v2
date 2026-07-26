import { describe, expect, it, vi } from "vitest";
import type { LocalSyncDatabase } from "../sync/repository";
import {
  beginLocalUpload,
  readCaptureUploadContext,
  replaceLocalUploadParts,
  setLocalUploadState,
} from "./upload-repository";

function scriptedDatabase(first: ReadonlyArray<unknown> = []) {
  const queue = [...first];
  const runAsync = vi.fn(
    async (_sql: string, ..._params: Array<string | number | null>) => undefined,
  );
  const database: LocalSyncDatabase = {
    async getAllAsync<T>() {
      return [] as ReadonlyArray<T>;
    },
    async getFirstAsync<T>() {
      return (queue.shift() ?? null) as T | null;
    },
    runAsync,
    async withTransactionAsync(task) {
      await task();
    },
  };
  return { database, runAsync };
}

describe("VLT-04 local upload repository", () => {
  it("derives device, household, child, and immutable object identifiers from local state", async () => {
    const expected = {
      assetId: "asset",
      childId: "child",
      declaredMime: "application/pdf",
      deviceId: "device",
      fileObjectId: "original",
      householdId: "household",
      localFileId: "original",
    } as const;
    const scripted = scriptedDatabase([expected]);

    await expect(readCaptureUploadContext(scripted.database, "asset")).resolves.toEqual(expected);
  });

  it("persists resumable facts without signed URLs or key material", async () => {
    const scripted = scriptedDatabase();
    await beginLocalUpload(scripted.database, {
      captureAssetId: "asset",
      childId: "child",
      expectedCiphertextBytes: 10,
      expectedCiphertextSha256: "a".repeat(64),
      expiresAt: null,
      fileObjectId: "object",
      localFileId: "file",
      sessionId: "session",
      updatedAt: "2026-07-25T00:00:00.000Z",
    });
    const sql = String(scripted.runAsync.mock.calls[0]?.[0]);
    expect(sql).toContain("local_upload_sessions");
    expect(sql).not.toContain("signed_url");
    expect(sql).not.toContain("encoded_file_key");
  });

  it("atomically replaces provider-confirmed parts and records truthful terminal state", async () => {
    const scripted = scriptedDatabase();
    await replaceLocalUploadParts(scripted.database, "session", [
      {
        byteCount: 5_242_880,
        etag: "etag-1",
        partNumber: 1,
        uploadedAt: "2026-07-25T00:01:00.000Z",
      },
    ]);
    await setLocalUploadState(scripted.database, {
      safeErrorCode: null,
      sessionId: "session",
      state: "uploaded",
      updatedAt: "2026-07-25T00:02:00.000Z",
    });
    expect(String(scripted.runAsync.mock.calls[0]?.[0])).toContain(
      "delete from local_upload_parts",
    );
    expect(String(scripted.runAsync.mock.calls[1]?.[0])).toContain("local_upload_parts");
    expect(scripted.runAsync.mock.calls.at(-1)?.slice(1)).toContain("uploaded");
  });
});

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createMemoryEncryptedObjectStorage } from "./memory.js";

const objectKey =
  "objects/019d3157-2000-7000-8000-000000000001/019d3157-2000-7000-8000-000000000002.lac";

describe("encrypted object storage", () => {
  it("completes, hashes, downloads, and deletes opaque multipart ciphertext", async () => {
    const storage = createMemoryEncryptedObjectStorage();
    const { providerUploadId } = await storage.initiateMultipart(objectKey);
    const first = await storage.putPart({
      bytes: new TextEncoder().encode("ciphertext-1"),
      objectKey,
      partNumber: 1,
      providerUploadId,
    });
    const second = await storage.putPart({
      bytes: new TextEncoder().encode("ciphertext-2"),
      objectKey,
      partNumber: 2,
      providerUploadId,
    });

    expect(await storage.listParts({ objectKey, providerUploadId })).toEqual([first, second]);
    await storage.completeMultipart({ objectKey, parts: [first, second], providerUploadId });
    expect(await storage.hashObject(objectKey)).toEqual({
      bytes: 24,
      sha256: createHash("sha256").update("ciphertext-1ciphertext-2").digest("hex"),
    });
    expect(await storage.signDownload({ expiresInSeconds: 300, objectKey })).toContain(
      "memory://download/",
    );
    await storage.deleteObject(objectKey);
    await expect(storage.headObject(objectKey)).rejects.toThrow("not found");
  });

  it("aborts incomplete multipart state idempotently at the service boundary", async () => {
    const storage = createMemoryEncryptedObjectStorage();
    const { providerUploadId } = await storage.initiateMultipart(objectKey);
    await storage.abortMultipart({ objectKey, providerUploadId });
    await expect(storage.listParts({ objectKey, providerUploadId })).rejects.toThrow("not found");
  });
});

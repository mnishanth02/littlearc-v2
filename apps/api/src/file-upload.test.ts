import { createHash } from "node:crypto";
import type {
  FilePreviewGrantPersistence,
  FileUploadPersistence,
  InternalFileObject,
  InternalUploadSession,
} from "@littlearc/database";
import type { UuidV7 } from "@littlearc/domain";
import { createMemoryEncryptedObjectStorage } from "@littlearc/storage";
import { describe, expect, it, vi } from "vitest";
import { createFileUploadService } from "./file-upload.js";

const fileObjectId = "019f8000-0000-7000-8000-000000000001" as UuidV7;
const sessionId = "019f8000-0000-7000-8000-000000000002" as UuidV7;
const captureAssetId = "019f8000-0000-7000-8000-000000000003" as UuidV7;
const childId = "019f8000-0000-7000-8000-000000000004" as UuidV7;
const deviceId = "019f8000-0000-7000-8000-000000000005" as UuidV7;
const requestId = "019f8000-0000-7000-8000-000000000006" as UuidV7;

describe("VLT-04 encrypted upload service", () => {
  it("coordinates multipart ciphertext and marks uploaded only after full digest verification", async () => {
    const storage = createMemoryEncryptedObjectStorage();
    const bytes = Buffer.from("synthetic-ciphertext");
    let session: InternalUploadSession | null = null;
    const complete = vi.fn(
      async (): Promise<InternalFileObject> => ({
        aadVersion: 1,
        authTag: Buffer.alloc(16),
        ciphertextBytes: bytes.length,
        ciphertextSha256: sha256(bytes),
        contentNonce: Buffer.alloc(12),
        declaredMime: "application/pdf",
        fileObjectId,
        keyVersion: 1,
        objectKey: requireSession().objectKey,
        previewState: "not_authorized",
        safeErrorCode: null,
        updatedAt: "2026-07-25T12:00:00.000Z",
        validationState: "pending",
        wrapNonce: Buffer.alloc(12),
        wrappedFileKey: Buffer.alloc(48),
      }),
    );
    const persistence: FileUploadPersistence = {
      async begin(input) {
        session = {
          aadVersion: 1,
          authTag: input.authTag,
          captureAssetId,
          childId,
          contentNonce: input.contentNonce,
          declaredMime: input.declaredMime,
          deviceId,
          expectedCiphertextBytes: input.expectedCiphertextBytes,
          expectedCiphertextSha256: input.expectedCiphertextSha256,
          expiresAt: "2026-07-26 12:34:56.789+00",
          fileObjectId,
          keyVersion: 1,
          objectKey: input.objectKey,
          parts: [],
          providerUploadId: input.providerUploadId,
          safeErrorCode: null,
          sessionId,
          state: "created",
          wrapNonce: Buffer.alloc(12),
          wrappedFileKey: Buffer.alloc(48),
        };
        return { replayed: false, session };
      },
      cancel: vi.fn(async () => undefined),
      complete,
      fail: vi.fn(async () => undefined),
      async markCompleting(input) {
        session = { ...requireSession(), parts: input.parts, state: "completing" };
        return session;
      },
      readDownload: vi.fn(async () => null),
      readStatus: vi.fn(async () => null),
      async readSession() {
        return session;
      },
      async reconcile(input) {
        session = { ...requireSession(), parts: input.parts, state: "uploading" };
        return session;
      },
    };
    const service = createFileUploadService({ enabled: true, persistence, storage });

    const created = await service.create({
      identityUserId: "consumer",
      request: {
        aadVersion: 1,
        authTag: Buffer.alloc(16).toString("base64"),
        captureAssetId,
        childId,
        ciphertextBytes: bytes.length,
        ciphertextSha256: sha256(bytes),
        contentNonce: Buffer.alloc(12).toString("base64"),
        declaredMime: "application/pdf",
        deviceId,
        encodedFileKey: Buffer.alloc(32, 1).toString("base64"),
        fileObjectId,
        uploadSessionId: sessionId,
      },
      requestId,
    });
    expect(created.session.state).toBe("created");
    expect(created.session.expiresAt).toBe("2026-07-26T12:34:56.789Z");
    const internal = requireSession();
    const part = await storage.putPart({
      bytes,
      objectKey: internal.objectKey,
      partNumber: 1,
      providerUploadId: internal.providerUploadId,
    });

    const object = await service.complete({
      identityUserId: "consumer",
      request: { parts: [part] },
      requestId,
      sessionId,
    });

    expect(object).toEqual({
      ciphertextBytes: bytes.length,
      ciphertextSha256: sha256(bytes),
      fileObjectId,
      uploadState: "uploaded",
      validationState: "pending",
    });
    expect(complete).toHaveBeenCalledOnce();

    function requireSession(): InternalUploadSession {
      if (!session) {
        throw new Error("Expected an upload session.");
      }
      return session;
    }
  });

  it("fails closed when encrypted uploads are disabled", async () => {
    const service = createFileUploadService({
      enabled: false,
      persistence: {} as FileUploadPersistence,
      storage: createMemoryEncryptedObjectStorage(),
    });

    await expect(service.read({ identityUserId: "consumer", sessionId })).rejects.toMatchObject({
      code: "unavailable",
    });
  });

  it("delegates replays to the persistence conflict boundary and aborts the redundant provider upload", async () => {
    const storage = createMemoryEncryptedObjectStorage();
    const abortMultipart = vi.spyOn(storage, "abortMultipart");
    const existing = uploadSession({
      expectedCiphertextBytes: 20,
      expectedCiphertextSha256: "a".repeat(64),
    });
    const begin = vi.fn(async () => {
      throw new Error("The upload idempotency boundary conflicts with existing ciphertext.");
    });
    const persistence = {
      begin,
      readSession: vi.fn(async () => existing),
    } as unknown as FileUploadPersistence;
    const service = createFileUploadService({ enabled: true, persistence, storage });

    await expect(
      service.create({
        identityUserId: "consumer",
        request: createRequest({
          ciphertextBytes: 21,
          ciphertextSha256: "b".repeat(64),
        }),
        requestId,
      }),
    ).rejects.toThrow("conflicts with existing ciphertext");

    expect(begin).toHaveBeenCalledOnce();
    expect(abortMultipart).toHaveBeenCalledOnce();
  });

  it("issues a five-minute ciphertext-only encrypted preview grant and clears its key", async () => {
    const storage = createMemoryEncryptedObjectStorage();
    vi.spyOn(storage, "signDownload").mockResolvedValue("https://storage.invalid/synthetic");
    const derivativeId = "019f8000-0000-7000-8000-000000000007" as UuidV7;
    const fileKey = Buffer.alloc(32, 7);
    const previewPersistence = {
      read: vi.fn(async () => ({
        aadVersion: 1 as const,
        authTag: Buffer.alloc(16, 1),
        ciphertextBytes: 20,
        ciphertextSha256: "a".repeat(64),
        contentNonce: Buffer.alloc(12, 2),
        derivativeId,
        fileKey,
        policyVersion: 1 as const,
        sourceFileObjectId: fileObjectId,
        storageKey: `derivatives/${derivativeId}/${requestId}.lac`,
      })),
    } as FilePreviewGrantPersistence;
    const service = createFileUploadService({
      enabled: true,
      persistence: {} as FileUploadPersistence,
      previewPersistence,
      storage,
    });

    const grant = await service.preview({
      deviceId,
      fileObjectId,
      identityUserId: "consumer",
      requestId,
    });

    expect(grant).toMatchObject({
      aadVersion: 1,
      ciphertextBytes: 20,
      declaredMime: "image/jpeg",
      derivativeId,
      fileObjectId,
      method: "GET",
      previewPolicyVersion: 1,
    });
    expect(grant).not.toHaveProperty("plaintext");
    expect(grant.url).toBe("https://storage.invalid/synthetic");
    expect(fileKey).toEqual(Buffer.alloc(32));
  });
});

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function createRequest(
  overrides: Partial<
    Parameters<ReturnType<typeof createFileUploadService>["create"]>[0]["request"]
  > = {},
): Parameters<ReturnType<typeof createFileUploadService>["create"]>[0]["request"] {
  return {
    aadVersion: 1,
    authTag: Buffer.alloc(16).toString("base64"),
    captureAssetId,
    childId,
    ciphertextBytes: 20,
    ciphertextSha256: "a".repeat(64),
    contentNonce: Buffer.alloc(12).toString("base64"),
    declaredMime: "application/pdf",
    deviceId,
    encodedFileKey: Buffer.alloc(32, 1).toString("base64"),
    fileObjectId,
    uploadSessionId: sessionId,
    ...overrides,
  };
}

function uploadSession(overrides: Partial<InternalUploadSession> = {}): InternalUploadSession {
  return {
    aadVersion: 1,
    authTag: Buffer.alloc(16),
    captureAssetId,
    childId,
    contentNonce: Buffer.alloc(12),
    declaredMime: "application/pdf",
    deviceId,
    expectedCiphertextBytes: 20,
    expectedCiphertextSha256: "a".repeat(64),
    expiresAt: "2026-07-26T12:34:56.789Z",
    fileObjectId,
    keyVersion: 1,
    objectKey: `objects/${fileObjectId}/${sessionId}.lac`,
    parts: [],
    providerUploadId: "provider-upload",
    safeErrorCode: null,
    sessionId,
    state: "created",
    wrapNonce: Buffer.alloc(12),
    wrappedFileKey: Buffer.alloc(48),
    ...overrides,
  };
}

import { createCipheriv, randomBytes } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canonicalFileAad,
  createFileKeyCrypto,
  createStructuredPayloadCrypto,
} from "@littlearc/crypto";
import type { ClaimedFileValidation, FileValidationPersistence } from "@littlearc/database";
import type { UuidV7 } from "@littlearc/domain";
import { createMemoryEncryptedObjectStorage } from "@littlearc/storage";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeMalwareScanner } from "../scanner/malware-scanner.js";
import { createWorkspaceManager } from "../workspace/workspace.js";
import { createFileValidationHandler } from "./handler.js";

const fileObjectId = "019f8000-0000-7000-8000-000000000001" as UuidV7;
const sessionId = "019f8000-0000-7000-8000-000000000002" as UuidV7;
const householdId = "019f8000-0000-7000-8000-000000000003" as UuidV7;
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("file validation handler", () => {
  it("commits ready only after plaintext workspace cleanup", async () => {
    const fixture = await createFixture("image/jpeg");
    const propose = vi.fn(async () => true);
    let cleaned = false;
    const commit = vi.fn(async () => {
      expect(cleaned).toBe(true);
      return true;
    });
    const manager = createWorkspaceManager(fixture.workspaceRoot);
    await manager.initialize();
    const handler = createFileValidationHandler({
      crypto: fixture.crypto,
      fileKeyCrypto: fixture.fileKeyCrypto,
      malwareScanner: createFakeMalwareScanner("clean"),
      pdfInspector: { inspect: vi.fn() },
      persistence: persistence(fixture.claim, { commit, propose }),
      storage: fixture.storage,
      workspace: {
        create: manager.create,
        async cleanup(attemptId) {
          await manager.cleanup(attemptId);
          cleaned = true;
        },
      },
    });

    await expect(handler(fileObjectId)).resolves.toBe("ready");
    expect(propose).toHaveBeenCalledWith(
      fileObjectId,
      expect.any(String),
      expect.objectContaining({
        detectedMime: "image/jpeg",
        malwareState: "clean",
        safeErrorCode: null,
        terminalState: "ready",
      }),
    );
    expect(commit).toHaveBeenCalledWith(fileObjectId, expect.any(String), "ready");
  });

  it("rejects a declared MIME mismatch and still cleans before commit", async () => {
    const fixture = await createFixture("application/pdf");
    const manager = createWorkspaceManager(fixture.workspaceRoot);
    await manager.initialize();
    let attemptPath: string | undefined;
    const create = async (attemptId: UuidV7) => {
      const workspace = await manager.create(attemptId);
      attemptPath = workspace.path;
      return workspace;
    };
    const commit = vi.fn(async () => {
      if (!attemptPath) {
        throw new Error("Expected attempt path.");
      }
      await expect(stat(attemptPath)).rejects.toMatchObject({ code: "ENOENT" });
      return true;
    });
    const propose = vi.fn(async () => true);
    const handler = createFileValidationHandler({
      crypto: fixture.crypto,
      fileKeyCrypto: fixture.fileKeyCrypto,
      malwareScanner: createFakeMalwareScanner("clean"),
      pdfInspector: { inspect: vi.fn() },
      persistence: persistence(fixture.claim, { commit, propose }),
      storage: fixture.storage,
      workspace: { cleanup: manager.cleanup, create },
    });

    await expect(handler(fileObjectId)).resolves.toBe("rejected");
    expect(propose).toHaveBeenCalledWith(
      fileObjectId,
      expect.any(String),
      expect.objectContaining({
        safeErrorCode: "type_mismatch",
        terminalState: "rejected",
      }),
    );
    expect(commit).toHaveBeenCalledWith(fileObjectId, expect.any(String), "rejected");
  });

  it("rejects malware without persisting scanner details", async () => {
    const fixture = await createFixture("image/jpeg");
    const manager = createWorkspaceManager(fixture.workspaceRoot);
    await manager.initialize();
    const commit = vi.fn(async () => true);
    const propose = vi.fn(async () => true);
    const handler = createFileValidationHandler({
      crypto: fixture.crypto,
      fileKeyCrypto: fixture.fileKeyCrypto,
      malwareScanner: createFakeMalwareScanner("detected"),
      pdfInspector: { inspect: vi.fn() },
      persistence: persistence(fixture.claim, { commit, propose }),
      storage: fixture.storage,
      workspace: manager,
    });

    await expect(handler(fileObjectId)).resolves.toBe("rejected");
    expect(propose).toHaveBeenCalledWith(
      fileObjectId,
      expect.any(String),
      expect.objectContaining({
        malwareState: "detected",
        safeErrorCode: "malware_detected",
        terminalState: "rejected",
      }),
    );
    expect(JSON.stringify(propose.mock.calls)).not.toContain("Eicar");
  });

  it("keeps cleanup failure nonterminal and schedules cleanup recovery", async () => {
    const fixture = await createFixture("image/jpeg");
    const manager = createWorkspaceManager(fixture.workspaceRoot);
    await manager.initialize();
    const retry = vi.fn(async () => true);
    const commit = vi.fn(async () => true);
    const handler = createFileValidationHandler({
      crypto: fixture.crypto,
      fileKeyCrypto: fixture.fileKeyCrypto,
      malwareScanner: createFakeMalwareScanner("clean"),
      pdfInspector: { inspect: vi.fn() },
      persistence: persistence(fixture.claim, {
        commit,
        propose: vi.fn(async () => true),
        retry,
      }),
      storage: fixture.storage,
      workspace: {
        create: manager.create,
        async cleanup() {
          throw new Error("synthetic cleanup failure");
        },
      },
    });

    await expect(handler(fileObjectId)).rejects.toMatchObject({
      code: "plaintext_cleanup_retry",
      retryable: true,
    });
    expect(retry).toHaveBeenCalledWith(fileObjectId, expect.any(String), "plaintext_cleanup_retry");
    expect(commit).not.toHaveBeenCalled();
  });

  it("keeps cancellation nonterminal and removes the attempt workspace", async () => {
    const fixture = await createFixture("image/jpeg");
    const manager = createWorkspaceManager(fixture.workspaceRoot);
    await manager.initialize();
    const retry = vi.fn(async () => true);
    const commit = vi.fn(async () => true);
    const propose = vi.fn(async () => true);
    const handler = createFileValidationHandler({
      crypto: fixture.crypto,
      fileKeyCrypto: fixture.fileKeyCrypto,
      malwareScanner: createFakeMalwareScanner("clean"),
      pdfInspector: { inspect: vi.fn() },
      persistence: persistence(fixture.claim, { commit, propose, retry }),
      storage: fixture.storage,
      workspace: manager,
    });
    const controller = new AbortController();
    controller.abort();

    await expect(handler(fileObjectId, controller.signal)).rejects.toMatchObject({
      retryable: true,
    });
    expect(retry).toHaveBeenCalledWith(
      fileObjectId,
      expect.any(String),
      "validation_retry_exhausted",
    );
    expect(propose).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    await expect(manager.scavenge(new Date())).resolves.toEqual([]);
  });
});

function persistence(
  claim: ClaimedFileValidation,
  overrides: {
    readonly commit: FileValidationPersistence["commit"];
    readonly propose: FileValidationPersistence["propose"];
    readonly retry?: FileValidationPersistence["retry"];
  },
): FileValidationPersistence {
  return {
    claim: vi.fn(async () => claim),
    claimDispatches: vi.fn(async () => []),
    commit: overrides.commit,
    failExhausted: vi.fn(async () => true),
    finishDispatch: vi.fn(async () => undefined),
    heartbeat: vi.fn(async () => true),
    listStale: vi.fn(async () => []),
    propose: overrides.propose,
    recover: vi.fn(async () => true),
    retry: overrides.retry ?? vi.fn(async () => true),
  };
}

async function createFixture(declaredMime: ClaimedFileValidation["declaredMime"]) {
  const plaintext = jpegFixture();
  const keyEncryptionKey = randomBytes(32);
  const crypto = createStructuredPayloadCrypto({
    keyEncryptionKey,
    wrappingKeyVersion: 1,
  });
  const household = crypto.createHouseholdKey();
  const fileKey = randomBytes(32);
  const fileKeyCrypto = createFileKeyCrypto({ currentKeyVersion: 1 });
  const context = {
    aadSchemaVersion: 1 as const,
    format: declaredMime,
    householdId,
    objectId: fileObjectId,
    purpose: "capture-original" as const,
  };
  const wrappedFile = fileKeyCrypto.wrap(fileKey, household.plaintextKey, context);
  const contentNonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", fileKey, contentNonce);
  cipher.setAAD(Buffer.from(canonicalFileAad(context)));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const storage = createMemoryEncryptedObjectStorage();
  const objectKey = `objects/${fileObjectId}/${sessionId}.lac`;
  const upload = await storage.initiateMultipart(objectKey);
  const part = await storage.putPart({
    bytes: ciphertext,
    objectKey,
    partNumber: 1,
    providerUploadId: upload.providerUploadId,
  });
  await storage.completeMultipart({
    objectKey,
    parts: [part],
    providerUploadId: upload.providerUploadId,
  });
  const workspaceParent = await mkdtemp(join(tmpdir(), "littlearc-handler-test-"));
  roots.push(workspaceParent);
  const claim: ClaimedFileValidation = {
    aadVersion: 1,
    authTag: cipher.getAuthTag(),
    ciphertextBytes: ciphertext.length,
    ciphertextSha256: (await storage.hashObject(objectKey)).sha256,
    contentNonce,
    declaredMime,
    fileKeyVersion: wrappedFile.keyVersion,
    fileObjectId,
    fileWrapNonce: wrappedFile.wrapNonce,
    householdId,
    householdKey: household.wrapped,
    objectKey,
    wrappedFileKey: wrappedFile.wrappedKey,
  };
  household.plaintextKey.fill(0);
  fileKey.fill(0);
  return {
    claim,
    crypto,
    fileKeyCrypto,
    storage,
    workspaceRoot: join(workspaceParent, "validation"),
  };
}

function jpegFixture(): Buffer {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01, 0x03, 0x01, 0x11,
    0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xda, 0x00, 0x0c, 0x03, 0x01, 0x00, 0x02, 0x11,
    0x03, 0x11, 0x00, 0x3f, 0x00, 0x00, 0xff, 0xd9,
  ]);
}

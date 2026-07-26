import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import {
  canonicalFileAad,
  createFileKeyCrypto,
  createStructuredPayloadCrypto,
} from "@littlearc/crypto";
import type { FilePreviewPersistence } from "@littlearc/database";
import type { UuidV7 } from "@littlearc/domain";
import type { EncryptedObjectStorage } from "@littlearc/storage";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeMalwareScanner } from "../scanner/malware-scanner.js";
import { createWorkspaceManager } from "../workspace/workspace.js";
import { createFilePreviewHandler } from "./handler.js";
import { PreviewRendererError } from "./renderer.js";

const derivativeId = "019f9000-0000-7000-8000-000000000001" as UuidV7;
const sourceObjectId = "019f9000-0000-7000-8000-000000000002" as UuidV7;
const householdId = "019f9000-0000-7000-8000-000000000003" as UuidV7;
const roots: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("encrypted preview handler", () => {
  it("publishes only after encrypted upload and verified plaintext cleanup", async () => {
    const fixture = await createFixture();
    const proposed: Array<{ readonly storageKey: string }> = [];
    const persistence = createPersistence(fixture.claim, {
      commit: vi.fn(async () => true),
      propose: vi.fn(async (_derivativeId, _attemptId, result) => {
        proposed.push({ storageKey: result.storageKey });
        return true;
      }),
    });
    const handler = createFilePreviewHandler({
      crypto: fixture.crypto,
      fileKeyCrypto: fixture.fileKeyCrypto,
      malwareScanner: createFakeMalwareScanner("clean"),
      persistence,
      renderer: {
        async probe() {
          throw new Error("Probe is outside the handler test.");
        },
        async render(input) {
          const { writeFile } = await import("node:fs/promises");
          const jpeg = Buffer.from(
            "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/AP/EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8hf//Z",
            "base64",
          );
          await writeFile(input.outputPath, jpeg, { mode: 0o600 });
          return { bytes: jpeg.length, height: 1, width: 1 };
        },
      },
      storage: fixture.storage,
      workspace: fixture.workspace,
    });

    await expect(handler(derivativeId)).resolves.toBe("ready");
    expect(proposed).toHaveLength(1);
    expect(proposed[0]?.storageKey).toMatch(/^derivatives\/.+\.lac$/);
    expect(persistence.commit).toHaveBeenCalledOnce();
    await expect(stat(fixture.lastAttemptPath())).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("commits deterministic invalid output as preview failure without changing the source", async () => {
    const fixture = await createFixture();
    const fail = vi.fn(async () => true);
    const retry = vi.fn(async () => true);
    const persistence = createPersistence(fixture.claim, { fail, retry });
    const handler = createFilePreviewHandler({
      crypto: fixture.crypto,
      fileKeyCrypto: fixture.fileKeyCrypto,
      malwareScanner: createFakeMalwareScanner("clean"),
      persistence,
      renderer: {
        async probe() {
          throw new Error("Probe is outside the handler test.");
        },
        async render() {
          throw new PreviewRendererError("output_invalid");
        },
      },
      storage: fixture.storage,
      workspace: fixture.workspace,
    });

    await expect(handler(derivativeId)).resolves.toBe("failed");
    expect(fail).toHaveBeenCalledWith(derivativeId, expect.any(String), "output_invalid");
    expect(retry).not.toHaveBeenCalled();
    expect(fixture.claim.sourceFileObjectId).toBe(sourceObjectId);
  });
});

async function createFixture() {
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const root = await mkdtemp(join(tmpdir(), "littlearc-preview-handler-"));
  roots.push(root);
  const workspaceRoot = join(root, "attempts");
  const workspace = createWorkspaceManager(workspaceRoot);
  await workspace.initialize();
  let attemptPath = "";
  const trackedWorkspace = {
    ...workspace,
    async create(attemptId: UuidV7) {
      const result = await workspace.create(attemptId);
      attemptPath = result.path;
      return result;
    },
  };
  const crypto = createStructuredPayloadCrypto({
    keyEncryptionKey: randomBytes(32),
    wrappingKeyVersion: 1,
  });
  const household = crypto.createHouseholdKey();
  const fileKeyCrypto = createFileKeyCrypto({ currentKeyVersion: 1 });
  const sourceKey = randomBytes(32);
  const context = {
    aadSchemaVersion: 1,
    format: "image/jpeg",
    householdId,
    objectId: sourceObjectId,
    purpose: "capture-original",
  } as const;
  const wrappedSource = fileKeyCrypto.wrap(sourceKey, household.plaintextKey, context);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sourceKey, nonce);
  cipher.setAAD(Buffer.from(canonicalFileAad(context)));
  const sourceCiphertext = Buffer.concat([
    cipher.update(Buffer.from("synthetic-source")),
    cipher.final(),
  ]);
  const sourceTag = cipher.getAuthTag();
  sourceKey.fill(0);
  household.plaintextKey.fill(0);
  const objects = new Map<string, Buffer>();
  const sourceObjectKey =
    "objects/019f9000-0000-7000-8000-000000000002/019f9000-0000-7000-8000-000000000004.lac";
  objects.set(sourceObjectKey, sourceCiphertext);
  const storage = {
    async deleteObject(objectKey: string) {
      objects.delete(objectKey);
    },
    async hashObject(objectKey: string) {
      const bytes = objects.get(objectKey);
      if (!bytes) {
        throw new Error("not found");
      }
      return { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
    },
    async readObjectStream(objectKey: string) {
      const bytes = objects.get(objectKey);
      if (!bytes) {
        throw new Error("not found");
      }
      return Readable.from(bytes);
    },
    async writeEncryptedObject(input: { readonly objectKey: string; readonly path: string }) {
      const bytes = await readFile(input.path);
      objects.set(input.objectKey, bytes);
      return { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
    },
  } as EncryptedObjectStorage;
  return {
    claim: {
      derivativeId,
      householdId,
      householdKey: household.wrapped,
      sourceAadVersion: 1 as const,
      sourceAuthTag: sourceTag,
      sourceCiphertextBytes: sourceCiphertext.length,
      sourceCiphertextSha256: createHash("sha256").update(sourceCiphertext).digest("hex"),
      sourceContentNonce: nonce,
      sourceFileObjectId: sourceObjectId,
      sourceKeyVersion: wrappedSource.keyVersion,
      sourceMime: "image/jpeg" as const,
      sourceObjectKey,
      sourceWrappedFileKey: wrappedSource.wrappedKey,
      sourceWrapNonce: wrappedSource.wrapNonce,
    },
    crypto,
    fileKeyCrypto,
    lastAttemptPath: () => attemptPath,
    storage,
    workspace: trackedWorkspace,
  };
}

function createPersistence(
  claim: Awaited<ReturnType<typeof createFixture>>["claim"],
  overrides: Partial<FilePreviewPersistence> = {},
): FilePreviewPersistence {
  return {
    async claim() {
      return claim;
    },
    claimDispatches: vi.fn(async () => []),
    commit: vi.fn(async () => true),
    ensureCandidates: vi.fn(async () => []),
    fail: vi.fn(async () => true),
    failExhausted: vi.fn(async () => true),
    finishDispatch: vi.fn(async () => undefined),
    heartbeat: vi.fn(async () => true),
    listStale: vi.fn(async () => []),
    propose: vi.fn(async () => true),
    recover: vi.fn(async () => true),
    retry: vi.fn(async () => true),
    ...overrides,
  };
}

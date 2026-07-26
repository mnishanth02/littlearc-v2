import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import {
  assertOpaqueObjectKey,
  type CompletedPart,
  type EncryptedObjectStorage,
  normalizeEtag,
} from "./storage.js";

type Upload = {
  readonly objectKey: string;
  readonly parts: Map<number, Buffer>;
};

export type MemoryEncryptedObjectStorage = EncryptedObjectStorage & {
  readonly putPart: (input: {
    readonly bytes: Uint8Array;
    readonly objectKey: string;
    readonly partNumber: number;
    readonly providerUploadId: string;
  }) => Promise<CompletedPart>;
  readonly readObject: (objectKey: string) => Uint8Array | undefined;
};

export function createMemoryEncryptedObjectStorage(): MemoryEncryptedObjectStorage {
  const uploads = new Map<string, Upload>();
  const objects = new Map<string, Buffer>();

  return {
    async abortMultipart(input) {
      const upload = uploads.get(input.providerUploadId);
      if (!upload) {
        return;
      }
      if (upload.objectKey !== input.objectKey) {
        throw new Error("Multipart upload did not match its object key.");
      }
      uploads.delete(input.providerUploadId);
      upload.parts.clear();
    },
    async completeMultipart(input) {
      const upload = requireUpload(uploads, input.providerUploadId, input.objectKey);
      const ordered = [...input.parts].sort((left, right) => left.partNumber - right.partNumber);
      if (ordered.length === 0 || ordered.some((part, index) => part.partNumber !== index + 1)) {
        throw new Error("Multipart completion requires contiguous ordered parts.");
      }
      const bytes = ordered.map((part) => {
        const stored = upload.parts.get(part.partNumber);
        if (!stored || etag(stored) !== normalizeEtag(part.etag) || stored.length !== part.size) {
          throw new Error("Multipart completion did not match stored parts.");
        }
        return stored;
      });
      objects.set(input.objectKey, Buffer.concat(bytes));
      uploads.delete(input.providerUploadId);
    },
    async deleteObject(objectKey) {
      objects.delete(objectKey);
    },
    async hashObject(objectKey) {
      const object = requireObject(objects, objectKey);
      return {
        bytes: object.length,
        sha256: createHash("sha256").update(object).digest("hex"),
      };
    },
    async headObject(objectKey) {
      return { bytes: requireObject(objects, objectKey).length };
    },
    async initiateMultipart(objectKey) {
      assertOpaqueObjectKey(objectKey);
      const providerUploadId = randomUUID();
      uploads.set(providerUploadId, { objectKey, parts: new Map() });
      return { providerUploadId };
    },
    async listParts(input) {
      const upload = requireUpload(uploads, input.providerUploadId, input.objectKey);
      return [...upload.parts]
        .sort(([left], [right]) => left - right)
        .map(([partNumber, bytes]) => ({
          etag: etag(bytes),
          partNumber,
          size: bytes.length,
        }));
    },
    async putPart(input) {
      const upload = requireUpload(uploads, input.providerUploadId, input.objectKey);
      if (
        !Number.isInteger(input.partNumber) ||
        input.partNumber < 1 ||
        input.partNumber > 10_000
      ) {
        throw new Error("Multipart part number is invalid.");
      }
      const bytes = Buffer.from(input.bytes);
      upload.parts.set(input.partNumber, bytes);
      return { etag: etag(bytes), partNumber: input.partNumber, size: bytes.length };
    },
    readObject(objectKey) {
      return objects.get(objectKey);
    },
    async readObjectStream(objectKey) {
      return Readable.from(Buffer.from(requireObject(objects, objectKey)));
    },
    async signDownload(input) {
      requireObject(objects, input.objectKey);
      return `memory://download/${encodeURIComponent(input.objectKey)}?ttl=${input.expiresInSeconds}`;
    },
    async signUploadPart(input) {
      requireUpload(uploads, input.providerUploadId, input.objectKey);
      return `memory://upload/${input.providerUploadId}/${input.partNumber}?ttl=${input.expiresInSeconds}`;
    },
    async writeEncryptedObject(input) {
      assertOpaqueObjectKey(input.objectKey);
      const bytes = await readFile(input.path);
      objects.set(input.objectKey, bytes);
      return {
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    },
  };
}

function requireUpload(
  uploads: Map<string, Upload>,
  providerUploadId: string,
  objectKey: string,
): Upload {
  const upload = uploads.get(providerUploadId);
  if (!upload || upload.objectKey !== objectKey) {
    throw new Error("Multipart upload was not found.");
  }
  return upload;
}

function requireObject(objects: Map<string, Buffer>, objectKey: string): Buffer {
  const object = objects.get(objectKey);
  if (!object) {
    throw new Error("Encrypted object was not found.");
  }
  return object;
}

function etag(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

import type { FileUploadPersistence, InternalUploadSession } from "@littlearc/database";
import type { UuidV7 } from "@littlearc/domain";
import type { EncryptedObjectStorage } from "@littlearc/storage";
import { multipartPartBytes } from "@littlearc/storage";

type CreateRequest = {
  readonly aadVersion: 1;
  readonly authTag: string;
  readonly captureAssetId: string;
  readonly childId: string;
  readonly ciphertextBytes: number;
  readonly ciphertextSha256: string;
  readonly contentNonce: string;
  readonly declaredMime: "application/pdf" | "image/heic" | "image/jpeg" | "image/png";
  readonly deviceId: string;
  readonly encodedFileKey: string;
  readonly fileObjectId: string;
  readonly uploadSessionId: string;
};
type CompleteRequest = {
  readonly parts: ReadonlyArray<{
    readonly etag: string;
    readonly partNumber: number;
    readonly size: number;
  }>;
};

export class FileUploadServiceError extends Error {
  readonly code: "integrity_mismatch" | "invalid_state" | "not_found" | "unavailable";

  constructor(code: FileUploadServiceError["code"], message: string) {
    super(message);
    this.name = "FileUploadServiceError";
    this.code = code;
  }
}

export type FileUploadService = ReturnType<typeof createFileUploadService>;

export function createFileUploadService(options: {
  readonly enabled: boolean;
  readonly persistence: FileUploadPersistence;
  readonly storage: EncryptedObjectStorage;
}) {
  return {
    async cancel(input: {
      readonly identityUserId: string;
      readonly requestId: UuidV7;
      readonly sessionId: UuidV7;
    }): Promise<void> {
      requireEnabled(options.enabled);
      const session = await requireSession(options.persistence, input);
      if (session.state === "uploaded") {
        throw new FileUploadServiceError("invalid_state", "Completed upload cannot be cancelled.");
      }
      if (session.state !== "cancelled") {
        await options.storage.abortMultipart({
          objectKey: session.objectKey,
          providerUploadId: session.providerUploadId,
        });
      }
      await options.persistence.cancel(input);
    },
    async complete(input: {
      readonly identityUserId: string;
      readonly request: CompleteRequest;
      readonly requestId: UuidV7;
      readonly sessionId: UuidV7;
    }) {
      requireEnabled(options.enabled);
      let session = await requireSession(options.persistence, input);
      if (session.state === "uploaded") {
        return projectFileObject(
          await options.persistence.complete({
            identityUserId: input.identityUserId,
            requestId: input.requestId,
            sessionId: input.sessionId,
          }),
        );
      }
      if (session.state !== "completing") {
        const providerParts = await options.storage.listParts({
          objectKey: session.objectKey,
          providerUploadId: session.providerUploadId,
        });
        if (!sameParts(providerParts, input.request.parts)) {
          throw new FileUploadServiceError(
            "invalid_state",
            "Multipart completion does not match provider state.",
          );
        }
        session = await options.persistence.markCompleting({
          identityUserId: input.identityUserId,
          parts: providerParts,
          sessionId: input.sessionId,
        });
        await options.storage.completeMultipart({
          objectKey: session.objectKey,
          parts: providerParts,
          providerUploadId: session.providerUploadId,
        });
      }
      const observed = await options.storage.hashObject(session.objectKey);
      if (
        observed.bytes !== session.expectedCiphertextBytes ||
        observed.sha256 !== session.expectedCiphertextSha256
      ) {
        await options.storage.deleteObject(session.objectKey);
        await options.persistence.fail({
          identityUserId: input.identityUserId,
          safeErrorCode: "ciphertext_integrity_mismatch",
          sessionId: input.sessionId,
        });
        throw new FileUploadServiceError(
          "integrity_mismatch",
          "Uploaded ciphertext integrity verification failed.",
        );
      }
      const object = await options.persistence.complete({
        identityUserId: input.identityUserId,
        requestId: input.requestId,
        sessionId: input.sessionId,
      });
      return projectFileObject(object);
    },
    async create(input: {
      readonly identityUserId: string;
      readonly request: CreateRequest;
      readonly requestId: UuidV7;
    }) {
      requireEnabled(options.enabled);
      const objectKey = `objects/${input.request.fileObjectId}/${input.request.uploadSessionId}.lac`;
      const fileKey = Buffer.from(input.request.encodedFileKey, "base64");
      const authTag = decodeExact(input.request.authTag, 16, "authTag");
      const contentNonce = decodeExact(input.request.contentNonce, 12, "contentNonce");
      let initiated: { readonly providerUploadId: string } | undefined;
      try {
        if (fileKey.length !== 32) {
          throw new FileUploadServiceError("invalid_state", "File key must be 256 bits.");
        }
        initiated = await options.storage.initiateMultipart(objectKey);
        const result = await options.persistence.begin({
          authTag,
          captureAssetId: input.request.captureAssetId as UuidV7,
          childId: input.request.childId as UuidV7,
          contentNonce,
          declaredMime: input.request.declaredMime,
          deviceId: input.request.deviceId as UuidV7,
          expectedCiphertextBytes: input.request.ciphertextBytes,
          expectedCiphertextSha256: input.request.ciphertextSha256,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          fileKey,
          fileObjectId: input.request.fileObjectId as UuidV7,
          identityUserId: input.identityUserId,
          objectKey,
          providerUploadId: initiated.providerUploadId,
          requestId: input.requestId,
          sessionId: input.request.uploadSessionId as UuidV7,
        });
        if (result.replayed) {
          await options.storage.abortMultipart({
            objectKey,
            providerUploadId: initiated.providerUploadId,
          });
          initiated = undefined;
        }
        return { replayed: result.replayed, session: projectSession(result.session) };
      } catch (error) {
        if (initiated) {
          await options.storage.abortMultipart({
            objectKey,
            providerUploadId: initiated.providerUploadId,
          });
        }
        throw error;
      } finally {
        fileKey.fill(0);
      }
    },
    async download(input: {
      readonly deviceId: UuidV7;
      readonly fileObjectId: UuidV7;
      readonly identityUserId: string;
      readonly requestId: UuidV7;
    }) {
      requireEnabled(options.enabled);
      const result = await options.persistence.readDownload(input);
      if (!result) {
        throw new FileUploadServiceError("not_found", "The file object was not found.");
      }
      try {
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        return {
          aadVersion: result.object.aadVersion,
          authTag: result.object.authTag.toString("base64"),
          ciphertextBytes: result.object.ciphertextBytes,
          ciphertextSha256: result.object.ciphertextSha256,
          contentNonce: result.object.contentNonce.toString("base64"),
          declaredMime: result.object.declaredMime,
          encodedFileKey: result.fileKey.toString("base64"),
          expiresAt,
          fileObjectId: result.object.fileObjectId,
          method: "GET" as const,
          url: await options.storage.signDownload({
            expiresInSeconds: 300,
            objectKey: result.object.objectKey,
          }),
        };
      } finally {
        result.fileKey.fill(0);
      }
    },
    async read(input: { readonly identityUserId: string; readonly sessionId: UuidV7 }) {
      requireEnabled(options.enabled);
      const session = await options.persistence.readSession(input);
      if (!session) {
        throw new FileUploadServiceError("not_found", "The upload session was not found.");
      }
      return projectSession(session);
    },
    async readStatus(input: { readonly fileObjectId: UuidV7; readonly identityUserId: string }) {
      requireEnabled(options.enabled);
      const object = await options.persistence.readStatus(input);
      if (!object) {
        throw new FileUploadServiceError("not_found", "The file object was not found.");
      }
      return {
        fileObjectId: object.fileObjectId,
        previewState: object.previewState,
        safeErrorCode: object.safeErrorCode,
        updatedAt: new Date(object.updatedAt).toISOString(),
        validationState: object.validationState,
      };
    },
    async reconcile(input: { readonly identityUserId: string; readonly sessionId: UuidV7 }) {
      requireEnabled(options.enabled);
      const session = await requireSession(options.persistence, input);
      const parts = await options.storage.listParts({
        objectKey: session.objectKey,
        providerUploadId: session.providerUploadId,
      });
      return projectSession(
        await options.persistence.reconcile({
          identityUserId: input.identityUserId,
          parts,
          sessionId: input.sessionId,
        }),
      );
    },
    async signPart(input: {
      readonly identityUserId: string;
      readonly partNumber: number;
      readonly sessionId: UuidV7;
    }) {
      requireEnabled(options.enabled);
      const session = await requireSession(options.persistence, input);
      if (!["created", "uploading"].includes(session.state)) {
        throw new FileUploadServiceError("invalid_state", "Upload is not accepting parts.");
      }
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      return {
        expiresAt,
        method: "PUT" as const,
        partNumber: input.partNumber,
        url: await options.storage.signUploadPart({
          expiresInSeconds: 600,
          objectKey: session.objectKey,
          partNumber: input.partNumber,
          providerUploadId: session.providerUploadId,
        }),
      };
    },
  };
}

function projectFileObject(object: Awaited<ReturnType<FileUploadPersistence["complete"]>>) {
  return {
    ciphertextBytes: object.ciphertextBytes,
    ciphertextSha256: object.ciphertextSha256,
    fileObjectId: object.fileObjectId,
    uploadState: "uploaded" as const,
    validationState: object.validationState,
  };
}

async function requireSession(
  persistence: FileUploadPersistence,
  input: { readonly identityUserId: string; readonly sessionId: UuidV7 },
): Promise<InternalUploadSession> {
  const session = await persistence.readSession(input);
  if (!session) {
    throw new FileUploadServiceError("not_found", "The upload session was not found.");
  }
  return session;
}

function requireEnabled(enabled: boolean): void {
  if (!enabled) {
    throw new FileUploadServiceError("unavailable", "Encrypted uploads are currently unavailable.");
  }
}

function projectSession(session: InternalUploadSession) {
  return {
    expiresAt: new Date(session.expiresAt).toISOString(),
    fileObjectId: session.fileObjectId,
    partBytes: multipartPartBytes,
    parts: session.parts,
    safeErrorCode: session.safeErrorCode,
    sessionId: session.sessionId,
    state:
      session.state === "completing"
        ? ("uploading" as const)
        : session.state === "expiring"
          ? ("expired" as const)
          : session.state,
  };
}

function decodeExact(value: string, bytes: number, name: string): Buffer {
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== bytes) {
    throw new FileUploadServiceError("invalid_state", `${name} has an invalid length.`);
  }
  return decoded;
}

function sameParts(
  left: ReadonlyArray<{
    readonly etag: string;
    readonly partNumber: number;
    readonly size: number;
  }>,
  right: ReadonlyArray<{
    readonly etag: string;
    readonly partNumber: number;
    readonly size: number;
  }>,
): boolean {
  const order = (
    parts: ReadonlyArray<{
      readonly etag: string;
      readonly partNumber: number;
      readonly size: number;
    }>,
  ) => [...parts].sort((a, b) => a.partNumber - b.partNumber);
  return JSON.stringify(order(left)) === JSON.stringify(order(right));
}

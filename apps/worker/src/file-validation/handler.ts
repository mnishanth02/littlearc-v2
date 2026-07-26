import { createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { rename } from "node:fs/promises";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  canonicalFileAad,
  decryptFileContent,
  type FileKeyCrypto,
  type StructuredPayloadCrypto,
} from "@littlearc/crypto";
import type { FileValidationPersistence } from "@littlearc/database";
import {
  createUuidV7,
  type FileMalwareState,
  type FileValidationSafeErrorCode,
  fileValidationLimits,
  type UuidV7,
} from "@littlearc/domain";
import type { EncryptedObjectStorage } from "@littlearc/storage";
import type { MalwareScanner } from "../scanner/malware-scanner.js";
import type { ValidationWorkspace } from "../workspace/workspace.js";
import { FileValidationError, type PdfInspector, validateFileStructure } from "./structure.js";

const validationPolicyVersion = 1;

export type ValidationWorkspaceManager = {
  readonly cleanup: (attemptId: UuidV7) => Promise<void>;
  readonly create: (attemptId: UuidV7) => Promise<ValidationWorkspace>;
};

export function createFileValidationHandler(options: {
  readonly crypto: StructuredPayloadCrypto;
  readonly fileKeyCrypto: FileKeyCrypto;
  readonly malwareScanner: MalwareScanner;
  readonly pdfInspector: PdfInspector;
  readonly persistence: FileValidationPersistence;
  readonly storage: EncryptedObjectStorage;
  readonly workspace: ValidationWorkspaceManager;
}) {
  return async function handle(
    fileObjectId: UuidV7,
    signal?: AbortSignal,
  ): Promise<"noop" | "ready" | "rejected"> {
    const attemptId = createUuidV7(randomBytes(10));
    const claimResult = await options.persistence.claim(fileObjectId, attemptId, 900);
    if (!claimResult) {
      return "noop";
    }
    const claim = claimResult;
    const leaseAbort = new AbortController();
    const validationSignal = signal
      ? AbortSignal.any([signal, leaseAbort.signal])
      : leaseAbort.signal;
    const heartbeats = new Set<Promise<void>>();
    const heartbeatTimer = setInterval(() => {
      if (heartbeats.size > 0) {
        return;
      }
      const heartbeat = options.persistence
        .heartbeat(fileObjectId, attemptId, 900)
        .then((maintained) => {
          if (!maintained) {
            leaseAbort.abort();
          }
        })
        .catch(() => {
          leaseAbort.abort();
        });
      heartbeats.add(heartbeat);
      void heartbeat.finally(() => {
        heartbeats.delete(heartbeat);
      });
    }, 60_000);

    try {
      return await executeClaim();
    } finally {
      clearInterval(heartbeatTimer);
      await Promise.allSettled(heartbeats);
    }

    async function executeClaim(): Promise<"ready" | "rejected"> {
      const workspace = await options.workspace.create(attemptId);
      let proposed:
        | {
            readonly detectedMime: typeof claim.declaredMime | null;
            readonly malwareState: FileMalwareState;
            readonly pageCount: number | null;
            readonly safeErrorCode: FileValidationSafeErrorCode | null;
            readonly terminalState: "ready" | "rejected";
          }
        | undefined;
      let retryCode: FileValidationSafeErrorCode | undefined;

      try {
        await downloadVerifiedCiphertext({
          expectedBytes: claim.ciphertextBytes,
          expectedSha256: claim.ciphertextSha256,
          objectKey: claim.objectKey,
          path: workspace.ciphertextPartPath,
          storage: options.storage,
          signal: validationSignal,
        });
        const householdKey = options.crypto.unwrapHouseholdKey(claim.householdKey);
        let fileKey: Buffer | undefined;
        try {
          fileKey = options.fileKeyCrypto.unwrap(
            {
              keyVersion: claim.fileKeyVersion,
              wrapNonce: claim.fileWrapNonce,
              wrappedKey: claim.wrappedFileKey,
            },
            householdKey,
            {
              aadSchemaVersion: claim.aadVersion,
              format: claim.declaredMime,
              householdId: claim.householdId,
              objectId: claim.fileObjectId,
              purpose: "capture-original",
            },
          );
          try {
            await decryptFileContent({
              aad: canonicalFileAad({
                aadSchemaVersion: claim.aadVersion,
                format: claim.declaredMime,
                householdId: claim.householdId,
                objectId: claim.fileObjectId,
                purpose: "capture-original",
              }),
              authTag: claim.authTag,
              ciphertext: createReadStream(workspace.ciphertextPartPath),
              fileKey,
              nonce: claim.contentNonce,
              plaintext: createWriteStream(workspace.inputPartPath, {
                flags: "wx",
                mode: 0o600,
              }),
              signal: validationSignal,
            });
          } catch (error) {
            if (validationSignal.aborted) {
              throw error;
            }
            throw new FileValidationError("authenticated_decryption_failed");
          }
        } finally {
          fileKey?.fill(0);
          householdKey.fill(0);
        }
        await rename(workspace.inputPartPath, workspace.inputPath);

        const structure = await validateFileStructure({
          declaredMime: claim.declaredMime,
          path: workspace.inputPath,
          pdfInspector: options.pdfInspector,
          signal: validationSignal,
        });
        if (!(await options.malwareScanner.ready(validationSignal))) {
          throw new FileValidationError("scanner_unavailable", true);
        }
        const scan = await options.malwareScanner.scan(createReadStream(workspace.inputPath), {
          maxBytes: fileValidationLimits.maxPlaintextBytes,
          signal: validationSignal,
        });
        if (scan.outcome === "detected") {
          proposed = {
            detectedMime: structure.detectedMime,
            malwareState: "detected",
            pageCount: structure.pageCount,
            safeErrorCode: "malware_detected",
            terminalState: "rejected",
          };
        } else if (scan.outcome !== "clean") {
          throw new FileValidationError("scanner_unavailable", true);
        } else {
          proposed = {
            detectedMime: structure.detectedMime,
            malwareState: "clean",
            pageCount: structure.pageCount,
            safeErrorCode: null,
            terminalState: "ready",
          };
        }
      } catch (error) {
        if (error instanceof FileValidationError && !error.retryable) {
          proposed = {
            detectedMime: null,
            malwareState: error.code === "malware_detected" ? "detected" : "pending",
            pageCount: null,
            safeErrorCode: error.code,
            terminalState: "rejected",
          };
        } else {
          retryCode =
            error instanceof FileValidationError ? error.code : "validation_retry_exhausted";
        }
      }

      if (proposed) {
        try {
          const persisted = await options.persistence.propose(fileObjectId, attemptId, {
            ...proposed,
            policyVersion: validationPolicyVersion,
          });
          if (!persisted) {
            retryCode = "validation_retry_exhausted";
            proposed = undefined;
          }
        } catch {
          retryCode = "validation_retry_exhausted";
          proposed = undefined;
        }
      }

      try {
        await options.workspace.cleanup(attemptId);
      } catch {
        await options.persistence.retry(fileObjectId, attemptId, "plaintext_cleanup_retry");
        throw new FileValidationError("plaintext_cleanup_retry", true);
      }

      if (proposed) {
        if (!(await options.persistence.commit(fileObjectId, attemptId, proposed.terminalState))) {
          throw new FileValidationError("validation_retry_exhausted", true);
        }
        return proposed.terminalState;
      }

      await options.persistence.retry(
        fileObjectId,
        attemptId,
        retryCode ?? "validation_retry_exhausted",
      );
      throw new FileValidationError(retryCode ?? "validation_retry_exhausted", true);
    }
  };
}

async function downloadVerifiedCiphertext(input: {
  readonly expectedBytes: number;
  readonly expectedSha256: string;
  readonly objectKey: string;
  readonly path: string;
  readonly signal?: AbortSignal;
  readonly storage: EncryptedObjectStorage;
}): Promise<void> {
  const hash = createHash("sha256");
  let bytes = 0;
  const verify = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > input.expectedBytes) {
        callback(new FileValidationError("ciphertext_integrity_mismatch"));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(
      await input.storage.readObjectStream(input.objectKey),
      verify,
      createWriteStream(input.path, { flags: "wx", mode: 0o600 }),
      { ...(input.signal ? { signal: input.signal } : {}) },
    );
  } catch (error) {
    if (error instanceof FileValidationError) {
      throw error;
    }
    throw error;
  }
  if (bytes !== input.expectedBytes || hash.digest("hex") !== input.expectedSha256) {
    throw new FileValidationError("ciphertext_integrity_mismatch");
  }
}

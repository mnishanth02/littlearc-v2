import { createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { rename, stat } from "node:fs/promises";
import {
  canonicalFileAad,
  decryptFileContent,
  encryptFileContent,
  type FileKeyCrypto,
  type StructuredPayloadCrypto,
} from "@littlearc/crypto";
import type { FilePreviewPersistence } from "@littlearc/database";
import {
  createUuidV7,
  type FilePreviewSafeErrorCode,
  filePreviewPolicy,
  type UuidV7,
} from "@littlearc/domain";
import type { EncryptedObjectStorage } from "@littlearc/storage";
import { downloadVerifiedCiphertext } from "../file-validation/handler.js";
import type { MalwareScanner } from "../scanner/malware-scanner.js";
import type { ValidationWorkspace } from "../workspace/workspace.js";
import { type PreviewRenderer, PreviewRendererError } from "./renderer.js";

export type PreviewWorkspaceManager = {
  readonly cleanup: (attemptId: UuidV7) => Promise<void>;
  readonly create: (attemptId: UuidV7) => Promise<ValidationWorkspace>;
};

export class FilePreviewError extends Error {
  readonly code: FilePreviewSafeErrorCode;

  constructor(code: FilePreviewSafeErrorCode) {
    super("Encrypted preview derivation failed.");
    this.name = "FilePreviewError";
    this.code = code;
  }
}

export function createFilePreviewHandler(options: {
  readonly crypto: StructuredPayloadCrypto;
  readonly fileKeyCrypto: FileKeyCrypto;
  readonly malwareScanner: MalwareScanner;
  readonly persistence: FilePreviewPersistence;
  readonly renderer: PreviewRenderer;
  readonly storage: EncryptedObjectStorage;
  readonly workspace: PreviewWorkspaceManager;
}) {
  return async function handle(
    derivativeId: UuidV7,
    signal?: AbortSignal,
  ): Promise<"failed" | "noop" | "ready"> {
    const attemptId = createUuidV7(randomBytes(10));
    const claim = await options.persistence.claim(derivativeId, attemptId, 900);
    if (!claim) {
      return "noop";
    }
    const leaseAbort = new AbortController();
    const previewSignal = signal ? AbortSignal.any([signal, leaseAbort.signal]) : leaseAbort.signal;
    const heartbeats = new Set<Promise<void>>();
    const heartbeatTimer = setInterval(() => {
      if (heartbeats.size > 0) {
        return;
      }
      const heartbeat = options.persistence
        .heartbeat(derivativeId, attemptId, 900)
        .then((maintained) => {
          if (!maintained) {
            leaseAbort.abort();
          }
        })
        .catch(() => {
          leaseAbort.abort();
        });
      heartbeats.add(heartbeat);
      void heartbeat.finally(() => heartbeats.delete(heartbeat));
    }, 60_000);

    try {
      const workspace = await options.workspace.create(attemptId);
      const candidateKey = `derivatives/${derivativeId}/${attemptId}.lac`;
      let candidateUploaded = false;
      let proposed = false;
      let failureCode: FilePreviewSafeErrorCode | undefined;
      try {
        await downloadVerifiedCiphertext({
          expectedBytes: claim.sourceCiphertextBytes,
          expectedSha256: claim.sourceCiphertextSha256,
          objectKey: claim.sourceObjectKey,
          path: workspace.ciphertextPartPath,
          signal: previewSignal,
          storage: options.storage,
        });
        const householdKey = options.crypto.unwrapHouseholdKey(claim.householdKey);
        let sourceFileKey: Buffer | undefined;
        try {
          sourceFileKey = options.fileKeyCrypto.unwrap(
            {
              keyVersion: claim.sourceKeyVersion,
              wrapNonce: claim.sourceWrapNonce,
              wrappedKey: claim.sourceWrappedFileKey,
            },
            householdKey,
            {
              aadSchemaVersion: claim.sourceAadVersion,
              format: claim.sourceMime,
              householdId: claim.householdId,
              objectId: claim.sourceFileObjectId,
              purpose: "capture-original",
            },
          );
          await decryptFileContent({
            aad: canonicalFileAad({
              aadSchemaVersion: claim.sourceAadVersion,
              format: claim.sourceMime,
              householdId: claim.householdId,
              objectId: claim.sourceFileObjectId,
              purpose: "capture-original",
            }),
            authTag: claim.sourceAuthTag,
            ciphertext: createReadStream(workspace.ciphertextPartPath),
            fileKey: sourceFileKey,
            nonce: claim.sourceContentNonce,
            plaintext: createWriteStream(workspace.inputPartPath, { flags: "wx", mode: 0o600 }),
            signal: previewSignal,
          });
        } finally {
          sourceFileKey?.fill(0);
          householdKey.fill(0);
        }
        await rename(workspace.inputPartPath, workspace.inputPath);
        const rendered = await options.renderer.render({
          inputPath: workspace.inputPath,
          intermediatePath: workspace.renderIntermediatePath,
          outputPath: workspace.previewPlaintextPartPath,
          signal: previewSignal,
          sourceMime: claim.sourceMime,
        });
        if (!(await options.malwareScanner.ready(previewSignal))) {
          throw new FilePreviewError("scanner_unavailable");
        }
        const scan = await options.malwareScanner.scan(
          createReadStream(workspace.previewPlaintextPartPath),
          { maxBytes: filePreviewPolicy.maxPlaintextBytes, signal: previewSignal },
        );
        if (scan.outcome === "retryable_unavailable") {
          throw new FilePreviewError("scanner_unavailable");
        }
        if (scan.outcome !== "clean") {
          throw new FilePreviewError("output_invalid");
        }

        const derivativeKey = randomBytes(32);
        const householdKeyForWrap = options.crypto.unwrapHouseholdKey(claim.householdKey);
        try {
          const context = {
            aadSchemaVersion: 1,
            derivativeId,
            format: "image/jpeg",
            previewPolicyVersion: 1,
            purpose: "validation-preview",
            sourceObjectId: claim.sourceFileObjectId,
          } as const;
          const encrypted = await encryptFileContent({
            aad: canonicalFileAad(context),
            ciphertext: createWriteStream(workspace.previewCiphertextPartPath, {
              flags: "wx",
              mode: 0o600,
            }),
            fileKey: derivativeKey,
            plaintext: createReadStream(workspace.previewPlaintextPartPath),
            signal: previewSignal,
          });
          const wrapped = options.fileKeyCrypto.wrap(derivativeKey, householdKeyForWrap, context);
          const local = await hashFile(workspace.previewCiphertextPartPath);
          if (local.bytes > filePreviewPolicy.maxCiphertextBytes) {
            throw new FilePreviewError("output_too_large");
          }
          const stored = await options.storage.writeEncryptedObject({
            objectKey: candidateKey,
            path: workspace.previewCiphertextPartPath,
          });
          candidateUploaded = true;
          if (stored.bytes !== local.bytes || stored.sha256 !== local.sha256) {
            throw new FilePreviewError("storage_integrity_mismatch");
          }
          proposed = await options.persistence.propose(derivativeId, attemptId, {
            authTag: encrypted.authTag,
            ciphertextBytes: stored.bytes,
            ciphertextSha256: stored.sha256,
            contentNonce: encrypted.nonce,
            keyVersion: wrapped.keyVersion,
            pixelHeight: rendered.height,
            pixelWidth: rendered.width,
            storageKey: candidateKey,
            wrappedFileKey: wrapped.wrappedKey,
            wrapNonce: wrapped.wrapNonce,
          });
          if (!proposed) {
            throw new FilePreviewError("storage_integrity_mismatch");
          }
        } finally {
          derivativeKey.fill(0);
          householdKeyForWrap.fill(0);
        }
      } catch (error) {
        if (error instanceof PreviewRendererError) {
          failureCode = error.code;
        } else if (error instanceof FilePreviewError) {
          failureCode = error.code;
        } else {
          failureCode = previewSignal.aborted ? "render_failed" : "storage_integrity_mismatch";
        }
      }

      if (failureCode && candidateUploaded && !proposed) {
        try {
          await options.storage.deleteObject(candidateKey);
          candidateUploaded = false;
        } catch {
          failureCode = "storage_integrity_mismatch";
        }
      }

      try {
        await options.workspace.cleanup(attemptId);
      } catch {
        await options.persistence.retry(derivativeId, attemptId, "plaintext_cleanup_retry");
        throw new FilePreviewError("plaintext_cleanup_retry");
      }

      if (proposed && !failureCode) {
        if (!(await options.persistence.commit(derivativeId, attemptId))) {
          throw new FilePreviewError("storage_integrity_mismatch");
        }
        return "ready";
      }
      const safeCode = failureCode ?? "render_failed";
      if (safeCode === "output_invalid" || safeCode === "output_too_large") {
        if (!(await options.persistence.fail(derivativeId, attemptId, safeCode))) {
          throw new FilePreviewError("preview_retry_exhausted");
        }
        return "failed";
      }
      await options.persistence.retry(derivativeId, attemptId, safeCode);
      throw new FilePreviewError(safeCode);
    } finally {
      clearInterval(heartbeatTimer);
      await Promise.allSettled(heartbeats);
    }
  };
}

async function hashFile(
  path: string,
): Promise<{ readonly bytes: number; readonly sha256: string }> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }
  return {
    bytes: (await stat(path)).size,
    sha256: hash.digest("hex"),
  };
}

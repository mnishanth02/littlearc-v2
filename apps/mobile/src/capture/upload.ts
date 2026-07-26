import {
  fileDownloadGrantSchema,
  fileObjectProjectionSchema,
  signedUploadPartSchema,
  uploadSessionSchema,
} from "@littlearc/contracts";
import { createUuidV7 } from "@littlearc/domain";
import { getRandomBytes } from "expo-crypto";
import { File } from "expo-file-system";
import { getMobileEnvironment } from "../bootstrap/environment";
import {
  importEncryptedLocalFileDownload,
  prepareEncryptedLocalFileUpload,
  withUnlockedLocalDatabase,
} from "../local-security/native";
import {
  beginLocalUpload,
  type LocalUploadPart,
  type LocalUploadSession,
  readCaptureUploadContext,
  readLocalUploadSession,
  replaceLocalUploadParts,
  setLocalUploadState,
  upsertLocalUploadPart,
} from "./upload-repository";

const multipartPartBytes = 5 * 1024 * 1024;

export type CaptureUploadRuntime = {
  readonly headers?: Readonly<Record<string, string>>;
};

export type CaptureUploadProgress = {
  readonly completedBytes: number;
  readonly state: "completing" | "uploaded" | "uploading";
  readonly totalBytes: number;
};

export async function uploadCaptureAsset(
  captureAssetId: string,
  options: CaptureUploadRuntime & {
    readonly onProgress?: (progress: CaptureUploadProgress) => void;
  } = {},
): Promise<LocalUploadSession> {
  const prepared = await withUnlockedLocalDatabase(async (database) => {
    const context = await readCaptureUploadContext(database, captureAssetId);
    if (!context) {
      throw new Error("The protected capture source is unavailable.");
    }
    const material = await prepareEncryptedLocalFileUpload(database, {
      fileId: context.localFileId,
      transport: {
        format: context.declaredMime,
        householdId: context.householdId,
        objectId: context.fileObjectId,
      },
    });
    let local = await readLocalUploadSession(database, captureAssetId);
    if (!local) {
      const now = new Date().toISOString();
      await beginLocalUpload(database, {
        captureAssetId,
        childId: context.childId,
        expectedCiphertextBytes: material.ciphertextBytes,
        expectedCiphertextSha256: material.ciphertextSha256,
        expiresAt: null,
        fileObjectId: context.fileObjectId,
        localFileId: context.localFileId,
        sessionId: opaqueId(),
        updatedAt: now,
      });
      local = await readLocalUploadSession(database, captureAssetId);
    }
    if (!local) {
      throw new Error("The local upload session could not be created.");
    }
    if (local.state === "cancelled" || local.state === "uploaded") {
      return { context, local, material };
    }
    return { context, local, material };
  });

  if (prepared.local.state === "cancelled" || prepared.local.state === "uploaded") {
    return prepared.local;
  }

  try {
    let remote = uploadSessionSchema.parse(
      await requestJson("/v1/files/uploads", options, {
        body: JSON.stringify({
          aadVersion: prepared.material.aadVersion,
          authTag: prepared.material.authTag,
          captureAssetId,
          childId: prepared.context.childId,
          ciphertextBytes: prepared.material.ciphertextBytes,
          ciphertextSha256: prepared.material.ciphertextSha256,
          contentNonce: prepared.material.contentNonce,
          declaredMime: prepared.context.declaredMime,
          deviceId: prepared.context.deviceId,
          encodedFileKey: prepared.material.encodedFileKey,
          fileObjectId: prepared.context.fileObjectId,
          uploadSessionId: prepared.local.sessionId,
        }),
        headers: {
          "idempotency-key": prepared.local.sessionId,
        },
        method: "POST",
      }),
    );
    await persistRemoteSession(captureAssetId, remote);
    remote = uploadSessionSchema.parse(
      await requestJson(
        `/v1/files/uploads/${encodeURIComponent(remote.sessionId)}/reconcile`,
        options,
        {
          body: JSON.stringify({ parts: prepared.local.parts.map(toRemotePart) }),
          method: "POST",
        },
      ),
    );
    await persistRemoteSession(captureAssetId, remote);

    const providerParts = new Map(remote.parts.map((part) => [part.partNumber, part]));
    const source = new File(prepared.material.ciphertextUri);
    if (!source.exists || source.size !== prepared.material.ciphertextBytes) {
      throw new Error("The protected upload ciphertext is unavailable.");
    }
    const handle = source.open();
    try {
      const totalParts = Math.ceil(prepared.material.ciphertextBytes / multipartPartBytes);
      for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
        if (providerParts.has(partNumber)) {
          options.onProgress?.({
            completedBytes: completedBytes(providerParts.values()),
            state: "uploading",
            totalBytes: prepared.material.ciphertextBytes,
          });
          continue;
        }
        const expectedBytes = Math.min(
          multipartPartBytes,
          prepared.material.ciphertextBytes - (partNumber - 1) * multipartPartBytes,
        );
        handle.offset = (partNumber - 1) * multipartPartBytes;
        const bytes = handle.readBytes(expectedBytes);
        if (bytes.length !== expectedBytes) {
          throw new Error("The encrypted upload part could not be read completely.");
        }
        const signed = signedUploadPartSchema.parse(
          await requestJson(
            `/v1/files/uploads/${encodeURIComponent(remote.sessionId)}/parts/${partNumber}`,
            options,
            { method: "POST" },
          ),
        );
        const part = await uploadOnePart(remote.sessionId, signed.url, partNumber, bytes, options);
        providerParts.set(partNumber, {
          etag: part.etag,
          partNumber: part.partNumber,
          size: part.byteCount,
        });
        await withUnlockedLocalDatabase((database) =>
          upsertLocalUploadPart(database, remote.sessionId, part),
        );
        options.onProgress?.({
          completedBytes: completedBytes(providerParts.values()),
          state: "uploading",
          totalBytes: prepared.material.ciphertextBytes,
        });
      }
    } finally {
      handle.close();
    }

    const orderedParts = [...providerParts.values()].sort(
      (left, right) => left.partNumber - right.partNumber,
    );
    await withUnlockedLocalDatabase((database) =>
      setLocalUploadState(database, {
        safeErrorCode: null,
        sessionId: remote.sessionId,
        state: "completing",
        updatedAt: new Date().toISOString(),
      }),
    );
    options.onProgress?.({
      completedBytes: prepared.material.ciphertextBytes,
      state: "completing",
      totalBytes: prepared.material.ciphertextBytes,
    });
    fileObjectProjectionSchema.parse(
      await requestJson(
        `/v1/files/uploads/${encodeURIComponent(remote.sessionId)}/complete`,
        options,
        {
          body: JSON.stringify({ parts: orderedParts }),
          headers: { "idempotency-key": prepared.context.fileObjectId },
          method: "POST",
        },
      ),
    );
    await withUnlockedLocalDatabase((database) =>
      setLocalUploadState(database, {
        safeErrorCode: null,
        sessionId: remote.sessionId,
        state: "uploaded",
        updatedAt: new Date().toISOString(),
      }),
    );
    options.onProgress?.({
      completedBytes: prepared.material.ciphertextBytes,
      state: "uploaded",
      totalBytes: prepared.material.ciphertextBytes,
    });
  } catch (error) {
    await withUnlockedLocalDatabase((database) =>
      setLocalUploadState(database, {
        safeErrorCode: safeUploadError(error),
        sessionId: prepared.local.sessionId,
        state: "failed",
        updatedAt: new Date().toISOString(),
      }),
    );
    throw error;
  }

  return withUnlockedLocalDatabase(async (database) => {
    const result = await readLocalUploadSession(database, captureAssetId);
    if (!result) {
      throw new Error("The completed local upload session is unavailable.");
    }
    return result;
  });
}

export async function cancelCaptureUpload(
  captureAssetId: string,
  options: CaptureUploadRuntime = {},
): Promise<void> {
  const local = await withUnlockedLocalDatabase((database) =>
    readLocalUploadSession(database, captureAssetId),
  );
  if (!local || local.state === "cancelled") {
    return;
  }
  if (local.state === "uploaded") {
    throw new Error("A completed encrypted upload cannot be cancelled.");
  }
  await requestJson(
    `/v1/files/uploads/${encodeURIComponent(local.sessionId)}`,
    options,
    { method: "DELETE" },
    true,
  );
  await withUnlockedLocalDatabase((database) =>
    setLocalUploadState(database, {
      safeErrorCode: null,
      sessionId: local.sessionId,
      state: "cancelled",
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function readCaptureUpload(
  captureAssetId: string,
): Promise<LocalUploadSession | null> {
  return withUnlockedLocalDatabase((database) => readLocalUploadSession(database, captureAssetId));
}

export async function downloadEncryptedFileObject(
  fileObjectId: string,
  options: CaptureUploadRuntime = {},
): Promise<string> {
  const enrollment = await withUnlockedLocalDatabase((database) =>
    database.getFirstAsync<{
      readonly deviceId: string;
      readonly householdId: string;
    }>(
      `select
         device_id as "deviceId",
         household_id as "householdId"
       from local_enrollment where singleton = 1`,
    ),
  );
  if (!enrollment) {
    throw new Error("The local enrollment is unavailable.");
  }
  const grant = fileDownloadGrantSchema.parse(
    await requestJson(
      `/v1/files/${encodeURIComponent(fileObjectId)}/download`,
      {
        ...options,
        headers: {
          ...options.headers,
          "x-littlearc-device-id": enrollment.deviceId,
        },
      },
      { method: "GET" },
    ),
  );
  const response = await fetch(grant.url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`The encrypted download returned HTTP ${response.status}.`);
  }
  const ciphertext = new Uint8Array(await response.arrayBuffer());
  if (ciphertext.length !== grant.ciphertextBytes) {
    throw new Error("The encrypted download size did not match its authorization.");
  }
  await withUnlockedLocalDatabase((database) =>
    importEncryptedLocalFileDownload(database, {
      authTag: grant.authTag,
      ciphertext,
      ciphertextSha256: grant.ciphertextSha256,
      contentNonce: grant.contentNonce,
      encodedFileKey: grant.encodedFileKey,
      transport: {
        format: grant.declaredMime,
        householdId: enrollment.householdId,
        objectId: grant.fileObjectId,
      },
    }),
  );
  return grant.fileObjectId;
}

async function uploadOnePart(
  sessionId: string,
  url: string,
  partNumber: number,
  bytes: Uint8Array,
  options: CaptureUploadRuntime,
): Promise<LocalUploadPart> {
  const response = await fetch(url, {
    body: new Uint8Array(bytes),
    headers: { "content-type": "application/octet-stream" },
    method: "PUT",
  });
  if (!response.ok) {
    throw new Error(`The encrypted upload part returned HTTP ${response.status}.`);
  }
  const etag = response.headers.get("etag");
  if (etag) {
    return {
      byteCount: bytes.length,
      etag,
      partNumber,
      uploadedAt: new Date().toISOString(),
    };
  }
  const reconciled = uploadSessionSchema.parse(
    await requestJson(`/v1/files/uploads/${encodeURIComponent(sessionId)}/reconcile`, options, {
      body: JSON.stringify({ parts: [] }),
      method: "POST",
    }),
  );
  const providerPart = reconciled.parts.find((part) => part.partNumber === partNumber);
  if (!providerPart) {
    throw new Error("The object store did not confirm the encrypted upload part.");
  }
  return {
    byteCount: providerPart.size,
    etag: providerPart.etag,
    partNumber,
    uploadedAt: new Date().toISOString(),
  };
}

async function persistRemoteSession(
  captureAssetId: string,
  remote: ReturnType<typeof uploadSessionSchema.parse>,
): Promise<void> {
  await withUnlockedLocalDatabase(async (database) => {
    const local = await readLocalUploadSession(database, captureAssetId);
    if (!local) {
      throw new Error("The local upload session is unavailable.");
    }
    await replaceLocalUploadParts(
      database,
      remote.sessionId,
      remote.parts.map((part) => ({
        byteCount: part.size,
        etag: part.etag,
        partNumber: part.partNumber,
        uploadedAt: new Date().toISOString(),
      })),
    );
    await setLocalUploadState(database, {
      expiresAt: remote.expiresAt,
      safeErrorCode: remote.safeErrorCode,
      sessionId: remote.sessionId,
      state: remote.state,
      updatedAt: new Date().toISOString(),
    });
  });
}

async function requestJson(
  path: string,
  options: CaptureUploadRuntime,
  init: RequestInit,
  emptyResponse = false,
): Promise<unknown> {
  const response = await fetch(`${getMobileEnvironment().apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`The encrypted upload request returned HTTP ${response.status}.`);
  }
  return emptyResponse || response.status === 204 ? undefined : response.json();
}

function completedBytes(parts: Iterable<{ readonly size: number }>): number {
  return [...parts].reduce((total, part) => total + part.size, 0);
}

function toRemotePart(part: LocalUploadPart) {
  return { etag: part.etag, partNumber: part.partNumber, size: part.byteCount };
}

function opaqueId(): string {
  return createUuidV7(getRandomBytes(10));
}

function safeUploadError(error: unknown): string {
  if (error instanceof TypeError) {
    return "network_unavailable";
  }
  return "upload_interrupted";
}

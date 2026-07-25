export const multipartPartBytes = 5 * 1024 * 1024;

export type CompletedPart = {
  readonly etag: string;
  readonly partNumber: number;
  readonly size: number;
};

export type StoredObjectMetadata = {
  readonly bytes: number;
  readonly sha256: string;
};

export type EncryptedObjectStorage = {
  readonly abortMultipart: (input: {
    readonly objectKey: string;
    readonly providerUploadId: string;
  }) => Promise<void>;
  readonly completeMultipart: (input: {
    readonly objectKey: string;
    readonly parts: ReadonlyArray<CompletedPart>;
    readonly providerUploadId: string;
  }) => Promise<void>;
  readonly deleteObject: (objectKey: string) => Promise<void>;
  readonly hashObject: (objectKey: string) => Promise<StoredObjectMetadata>;
  readonly headObject: (objectKey: string) => Promise<{ readonly bytes: number }>;
  readonly initiateMultipart: (objectKey: string) => Promise<{
    readonly providerUploadId: string;
  }>;
  readonly listParts: (input: {
    readonly objectKey: string;
    readonly providerUploadId: string;
  }) => Promise<ReadonlyArray<CompletedPart>>;
  readonly signDownload: (input: {
    readonly expiresInSeconds: number;
    readonly objectKey: string;
  }) => Promise<string>;
  readonly signUploadPart: (input: {
    readonly expiresInSeconds: number;
    readonly objectKey: string;
    readonly partNumber: number;
    readonly providerUploadId: string;
  }) => Promise<string>;
};

export function assertOpaqueObjectKey(value: string): void {
  if (!/^objects\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.lac$/.test(value)) {
    throw new Error("Object storage key must use the opaque VLT-04 shape.");
  }
}

export function normalizeEtag(value: string): string {
  const normalized = value.trim().replace(/^"|"$/g, "");
  if (!/^[\x21-\x7e]{1,256}$/.test(normalized)) {
    throw new Error("Multipart ETag is invalid.");
  }
  return normalized;
}

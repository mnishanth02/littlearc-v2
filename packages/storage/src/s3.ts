import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertOpaqueObjectKey, type EncryptedObjectStorage, normalizeEtag } from "./storage.js";

export type S3EncryptedObjectStorageConfig = {
  readonly accessKeyId: string;
  readonly bucket: string;
  readonly endpoint: string;
  readonly region: string;
  readonly secretAccessKey: string;
};

export function createS3EncryptedObjectStorage(
  config: S3EncryptedObjectStorageConfig,
): EncryptedObjectStorage {
  const client = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    forcePathStyle: true,
    region: config.region,
  });
  const bucket = config.bucket;

  return {
    async abortMultipart(input) {
      try {
        await client.send(
          new AbortMultipartUploadCommand({
            Bucket: bucket,
            Key: input.objectKey,
            UploadId: input.providerUploadId,
          }),
        );
      } catch (error) {
        if (!isMissingUpload(error)) {
          throw error;
        }
      }
    },
    async completeMultipart(input) {
      await client.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: input.objectKey,
          MultipartUpload: {
            Parts: [...input.parts]
              .sort((left, right) => left.partNumber - right.partNumber)
              .map((part) => ({
                ETag: normalizeEtag(part.etag),
                PartNumber: part.partNumber,
              })),
          },
          UploadId: input.providerUploadId,
        }),
      );
    },
    async deleteObject(objectKey) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
    },
    async hashObject(objectKey) {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
      if (!response.Body) {
        throw new Error("Encrypted object response had no body.");
      }
      const hash = createHash("sha256");
      let bytes = 0;
      for await (const chunk of response.Body.transformToWebStream()) {
        bytes += chunk.byteLength;
        hash.update(chunk);
      }
      return { bytes, sha256: hash.digest("hex") };
    },
    async headObject(objectKey) {
      const response = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
      if (response.ContentLength === undefined) {
        throw new Error("Encrypted object size is unavailable.");
      }
      return { bytes: response.ContentLength };
    },
    async initiateMultipart(objectKey) {
      assertOpaqueObjectKey(objectKey);
      const response = await client.send(
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          ContentType: "application/octet-stream",
          Key: objectKey,
        }),
      );
      if (!response.UploadId) {
        throw new Error("Object provider did not return a multipart upload identifier.");
      }
      return { providerUploadId: response.UploadId };
    },
    async listParts(input) {
      const parts = [];
      let marker: string | undefined;
      do {
        const response = await client.send(
          new ListPartsCommand({
            Bucket: bucket,
            Key: input.objectKey,
            ...(marker ? { PartNumberMarker: marker } : {}),
            UploadId: input.providerUploadId,
          }),
        );
        for (const part of response.Parts ?? []) {
          if (!part.ETag || !part.PartNumber || part.Size === undefined) {
            throw new Error("Object provider returned an incomplete multipart part.");
          }
          parts.push({
            etag: normalizeEtag(part.ETag),
            partNumber: part.PartNumber,
            size: part.Size,
          });
        }
        marker = response.IsTruncated ? response.NextPartNumberMarker : undefined;
      } while (marker);
      return parts;
    },
    async readObjectStream(objectKey) {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
      if (!response.Body) {
        throw new Error("Encrypted object response had no body.");
      }
      return Readable.fromWeb(response.Body.transformToWebStream() as never);
    },
    async signDownload(input) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: input.objectKey }), {
        expiresIn: input.expiresInSeconds,
      });
    },
    async signUploadPart(input) {
      return getSignedUrl(
        client,
        new UploadPartCommand({
          Bucket: bucket,
          Key: input.objectKey,
          PartNumber: input.partNumber,
          UploadId: input.providerUploadId,
        }),
        { expiresIn: input.expiresInSeconds },
      );
    },
    async writeEncryptedObject(input) {
      assertOpaqueObjectKey(input.objectKey);
      const { createReadStream } = await import("node:fs");
      await client.send(
        new PutObjectCommand({
          Body: createReadStream(input.path),
          Bucket: bucket,
          ContentType: "application/octet-stream",
          Key: input.objectKey,
        }),
      );
      const response = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: input.objectKey }),
      );
      if (!response.Body) {
        throw new Error("Encrypted object response had no body.");
      }
      const hash = createHash("sha256");
      let bytes = 0;
      for await (const chunk of response.Body.transformToWebStream()) {
        bytes += chunk.byteLength;
        hash.update(chunk);
      }
      return { bytes, sha256: hash.digest("hex") };
    },
  };
}

function isMissingUpload(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as {
    readonly $metadata?: { readonly httpStatusCode?: number };
    readonly name?: string;
  };
  return candidate.name === "NoSuchUpload" || candidate.$metadata?.httpStatusCode === 404;
}

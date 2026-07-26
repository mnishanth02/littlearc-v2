import { createHash, randomUUID } from "node:crypto";
import { createS3EncryptedObjectStorage } from "../../packages/storage/dist/index.js";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the staging object-storage probe.`);
  }
  return value;
};

const storage = createS3EncryptedObjectStorage({
  accessKeyId: required("S3_ACCESS_KEY_ID"),
  bucket: required("S3_BUCKET_NAME"),
  endpoint: required("S3_ENDPOINT"),
  region: process.env.S3_REGION?.trim() || "auto",
  secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
});
const objectId = randomUUID();
const sessionId = randomUUID();
const objectKey = `objects/${objectId}/${sessionId}.lac`;
const incompleteKey = `objects/${randomUUID()}/${randomUUID()}.lac`;
const ciphertext = Buffer.from("VLT04_RAILWAY_SYNTHETIC_CIPHERTEXT");
let completed = false;
let upload;
let incomplete;

try {
  upload = await storage.initiateMultipart(objectKey);
  const signed = await storage.signUploadPart({
    expiresInSeconds: 60,
    objectKey,
    partNumber: 1,
    providerUploadId: upload.providerUploadId,
  });
  const put = await fetch(signed, { body: ciphertext, method: "PUT" });
  if (!put.ok) {
    throw new Error(`Signed multipart PUT returned HTTP ${put.status}.`);
  }
  const parts = await storage.listParts({
    objectKey,
    providerUploadId: upload.providerUploadId,
  });
  if (parts.length !== 1 || parts[0]?.size !== ciphertext.length) {
    throw new Error("Provider part reconciliation returned unexpected metadata.");
  }
  await storage.completeMultipart({
    objectKey,
    parts,
    providerUploadId: upload.providerUploadId,
  });
  completed = true;
  const [head, digest, downloadUrl] = await Promise.all([
    storage.headObject(objectKey),
    storage.hashObject(objectKey),
    storage.signDownload({ expiresInSeconds: 60, objectKey }),
  ]);
  const download = await fetch(downloadUrl);
  const downloaded = Buffer.from(await download.arrayBuffer());
  const expectedDigest = createHash("sha256").update(ciphertext).digest("hex");
  if (
    !download.ok ||
    head.bytes !== ciphertext.length ||
    digest.bytes !== ciphertext.length ||
    digest.sha256 !== expectedDigest ||
    !downloaded.equals(ciphertext)
  ) {
    throw new Error("Provider completion, digest, or signed download verification failed.");
  }

  incomplete = await storage.initiateMultipart(incompleteKey);
  await storage.abortMultipart({
    objectKey: incompleteKey,
    providerUploadId: incomplete.providerUploadId,
  });
  await storage.abortMultipart({
    objectKey: incompleteKey,
    providerUploadId: incomplete.providerUploadId,
  });
  incomplete = undefined;

  console.log("VLT-04 Railway staging object-storage probe passed.");
  console.log("- Multipart initiate, signed PUT, list, complete, head, hash, and download passed.");
  console.log("- Repeated incomplete-upload abort passed.");
  console.log("- Synthetic object cleanup follows before process exit.");
} finally {
  if (incomplete) {
    await storage
      .abortMultipart({
        objectKey: incompleteKey,
        providerUploadId: incomplete.providerUploadId,
      })
      .catch(() => undefined);
  }
  if (completed) {
    await storage.deleteObject(objectKey).catch(() => undefined);
  } else if (upload) {
    await storage
      .abortMultipart({
        objectKey,
        providerUploadId: upload.providerUploadId,
      })
      .catch(() => undefined);
  }
}

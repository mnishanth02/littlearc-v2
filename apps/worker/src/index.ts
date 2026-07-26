import { access } from "node:fs/promises";
import { createFileKeyCrypto, createStructuredPayloadCrypto } from "@littlearc/crypto";
import {
  createDatabaseConnection,
  createFileValidationPersistence,
  createUploadCleanupPersistence,
} from "@littlearc/database";
import { createSafeLogger } from "@littlearc/observability";
import { createS3EncryptedObjectStorage } from "@littlearc/storage";
import { loadWorkerConfig } from "./config.js";
import { createFileValidationHandler } from "./file-validation/handler.js";
import { createQpdfInspector } from "./file-validation/pdf.js";
import { createFileValidationQueueRuntime } from "./queue/file-validation-queue.js";
import { createWorkerRuntime } from "./runtime.js";
import { createClamdScanner } from "./scanner/malware-scanner.js";
import { createWorkspaceManager } from "./workspace/workspace.js";

const config = loadWorkerConfig();
if (config.stagingProbeEnabled) {
  if (!config.fileValidation.enabled) {
    throw new Error("The staging probe requires file validation to be enabled.");
  }
  await import("./staging-probe.js");
}
const databaseConnection = config.databaseUrl
  ? createDatabaseConnection(config.databaseUrl)
  : undefined;
const storage = config.uploadStorage
  ? createS3EncryptedObjectStorage({
      accessKeyId: config.uploadStorage.accessKeyId,
      bucket: config.uploadStorage.bucket,
      endpoint: config.uploadStorage.endpoint,
      region: config.uploadStorage.region,
      secretAccessKey: config.uploadStorage.secretAccessKey,
    })
  : undefined;
const logger = createSafeLogger({
  environment: config.appEnv,
  service: "worker",
  sink(record) {
    console.log(JSON.stringify(record));
  },
  version: "0.0.0",
});
const runtime = createWorkerRuntime(
  config,
  logger,
  databaseConnection && storage
    ? {
        persistence: createUploadCleanupPersistence(databaseConnection.database),
        storage,
      }
    : undefined,
);

let validationRuntime: ReturnType<typeof createFileValidationQueueRuntime> | undefined;
if (config.fileValidation.enabled) {
  if (!databaseConnection || !storage || !config.databaseUrl) {
    throw new Error("File validation dependencies are unavailable.");
  }
  await access(config.fileValidation.qpdfExecutable);
  if (config.fileValidation.sandboxExecutable) {
    await access(config.fileValidation.sandboxExecutable);
  }
  const scanner = createClamdScanner({
    host: config.fileValidation.clamdHost,
    minimumSignatureVersion: config.fileValidation.signatureMinimumVersion,
    port: config.fileValidation.clamdPort,
    signatureMaxAgeHours: config.fileValidation.signatureMaxAgeHours,
    signatureObservedAt: config.fileValidation.signatureObservedAt,
  });
  const scannerReadiness = await scanner.readiness();
  if (scannerReadiness.status !== "ready") {
    throw new Error(
      `Malware scanner readiness failed: ${scannerReadiness.status}; signatureVersion=${scannerReadiness.signatureVersion ?? "unavailable"}.`,
    );
  }
  const workspace = createWorkspaceManager(config.fileValidation.tmpDir);
  const persistence = createFileValidationPersistence(databaseConnection.database);
  const handler = createFileValidationHandler({
    crypto: createStructuredPayloadCrypto({
      keyEncryptionKey: config.fileValidation.keyEncryptionKey,
      wrappingKeyVersion: 1,
    }),
    fileKeyCrypto: createFileKeyCrypto({ currentKeyVersion: 1 }),
    malwareScanner: scanner,
    pdfInspector: createQpdfInspector({
      executable: config.fileValidation.qpdfExecutable,
      ...(config.fileValidation.sandboxExecutable
        ? { sandboxExecutable: config.fileValidation.sandboxExecutable }
        : {}),
    }),
    persistence,
    storage,
    workspace,
  });
  validationRuntime = createFileValidationQueueRuntime({
    concurrency: config.fileValidation.concurrency,
    databaseUrl: config.databaseUrl,
    handle: handler,
    logger,
    persistence,
    workspace,
  });
  await validationRuntime.start();
}
runtime.start();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    runtime.stop();
    await validationRuntime?.stop();
    await databaseConnection?.close();
    process.exit(0);
  });
}

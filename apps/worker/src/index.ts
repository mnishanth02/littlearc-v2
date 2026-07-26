import { access } from "node:fs/promises";
import { createFileKeyCrypto, createStructuredPayloadCrypto } from "@littlearc/crypto";
import {
  createDatabaseConnection,
  createFilePreviewPersistence,
  createFileValidationPersistence,
  createUploadCleanupPersistence,
} from "@littlearc/database";
import { createSafeLogger } from "@littlearc/observability";
import { createS3EncryptedObjectStorage } from "@littlearc/storage";
import { loadWorkerConfig } from "./config.js";
import { createFilePreviewHandler } from "./file-preview/handler.js";
import { createPreviewRenderer } from "./file-preview/renderer.js";
import { createFileValidationHandler } from "./file-validation/handler.js";
import { createSharpHeicDecoder } from "./file-validation/heic-decoder.js";
import { createParserPermit } from "./file-validation/parser-permit.js";
import { createQpdfInspector } from "./file-validation/pdf.js";
import { createFilePreviewQueueRuntime } from "./queue/file-preview-queue.js";
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
let previewRuntime: ReturnType<typeof createFilePreviewQueueRuntime> | undefined;
if (config.fileValidation.enabled) {
  if (!databaseConnection || !storage || !config.databaseUrl) {
    throw new Error("File validation dependencies are unavailable.");
  }
  await access(config.fileValidation.qpdfExecutable);
  await access(config.fileValidation.pdftoppmExecutable);
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
  const parserPermit = createParserPermit();
  const heicDecoder = createSharpHeicDecoder({
    ...(config.fileValidation.sandboxExecutable
      ? { sandboxExecutable: config.fileValidation.sandboxExecutable }
      : {}),
    parserPermit,
  });
  await heicDecoder.probe();
  const persistence = createFileValidationPersistence(databaseConnection.database);
  const handler = createFileValidationHandler({
    crypto: createStructuredPayloadCrypto({
      keyEncryptionKey: config.fileValidation.keyEncryptionKey,
      wrappingKeyVersion: 1,
    }),
    fileKeyCrypto: createFileKeyCrypto({ currentKeyVersion: 1 }),
    heicDecoder,
    malwareScanner: scanner,
    pdfInspector: createQpdfInspector({
      executable: config.fileValidation.qpdfExecutable,
      parserPermit,
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
  if (config.fileValidation.previewsEnabled) {
    const previewPersistence = createFilePreviewPersistence(databaseConnection.database);
    const renderer = createPreviewRenderer({
      parserPermit,
      pdftoppmExecutable: config.fileValidation.pdftoppmExecutable,
      ...(config.fileValidation.sandboxExecutable
        ? { sandboxExecutable: config.fileValidation.sandboxExecutable }
        : {}),
    });
    await renderer.probe();
    previewRuntime = createFilePreviewQueueRuntime({
      databaseUrl: config.databaseUrl,
      handle: createFilePreviewHandler({
        crypto: createStructuredPayloadCrypto({
          keyEncryptionKey: config.fileValidation.keyEncryptionKey,
          wrappingKeyVersion: 1,
        }),
        fileKeyCrypto: createFileKeyCrypto({ currentKeyVersion: 1 }),
        malwareScanner: scanner,
        persistence: previewPersistence,
        renderer,
        storage,
        workspace,
      }),
      logger,
      persistence: previewPersistence,
      storage,
      workspace,
    });
    await previewRuntime.start();
  }
}
runtime.start();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    runtime.stop();
    await previewRuntime?.stop();
    await validationRuntime?.stop();
    await databaseConnection?.close();
    process.exit(0);
  });
}

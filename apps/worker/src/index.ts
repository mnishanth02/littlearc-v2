import { createDatabaseConnection, createUploadCleanupPersistence } from "@littlearc/database";
import { createSafeLogger } from "@littlearc/observability";
import { createS3EncryptedObjectStorage } from "@littlearc/storage";
import { loadWorkerConfig } from "./config.js";
import { createWorkerRuntime } from "./runtime.js";

const config = loadWorkerConfig();
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
const runtime = createWorkerRuntime(
  config,
  createSafeLogger({
    environment: config.appEnv,
    service: "worker",
    sink(record) {
      console.log(JSON.stringify(record));
    },
    version: "0.0.0",
  }),
  databaseConnection && storage
    ? {
        persistence: createUploadCleanupPersistence(databaseConnection.database),
        storage,
      }
    : undefined,
);

runtime.start();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    runtime.stop();
    await databaseConnection?.close();
    process.exit(0);
  });
}

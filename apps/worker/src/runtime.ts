import type { UploadCleanupPersistence } from "@littlearc/database";
import { logCodes, type SafeLogger } from "@littlearc/observability";
import type { EncryptedObjectStorage } from "@littlearc/storage";
import type { WorkerConfig } from "./config.js";

export type WorkerRuntime = {
  readonly start: () => void;
  readonly stop: () => void;
};

type Timer = ReturnType<typeof setInterval>;

export function createWorkerRuntime(
  config: WorkerConfig,
  logger: SafeLogger,
  uploadCleanup?: {
    readonly persistence: UploadCleanupPersistence;
    readonly storage: EncryptedObjectStorage;
  },
): WorkerRuntime {
  let heartbeatTimer: Timer | undefined;
  let uploadCleanupTimer: Timer | undefined;
  let cleanupRunning = false;

  return {
    start() {
      logger.info(logCodes.workerStarted, { outcome: "started" });

      heartbeatTimer = setInterval(() => {
        logger.info(logCodes.workerHeartbeat, { outcome: "heartbeat" });
      }, config.heartbeatIntervalMs);
      if (uploadCleanup) {
        uploadCleanupTimer = setInterval(() => {
          if (cleanupRunning) {
            return;
          }
          cleanupRunning = true;
          void cleanupExpiredUploads(uploadCleanup, logger)
            .catch(() => {
              logger.error(logCodes.workerUploadCleanupFailed, { outcome: "failed" });
            })
            .finally(() => {
              cleanupRunning = false;
            });
        }, config.uploadCleanupIntervalMs);
      }
    },
    stop() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = undefined;
      }
      if (uploadCleanupTimer) {
        clearInterval(uploadCleanupTimer);
        uploadCleanupTimer = undefined;
      }

      logger.info(logCodes.workerStopped, { outcome: "stopped" });
    },
  };
}

async function cleanupExpiredUploads(
  input: {
    readonly persistence: UploadCleanupPersistence;
    readonly storage: EncryptedObjectStorage;
  },
  logger: SafeLogger,
): Promise<void> {
  const claims = await input.persistence.claim(20);
  for (const claim of claims) {
    let succeeded = false;
    try {
      await input.storage.abortMultipart({
        objectKey: claim.objectKey,
        providerUploadId: claim.providerUploadId,
      });
      succeeded = true;
    } catch {
      logger.error(logCodes.workerUploadCleanupFailed, { outcome: "failed" });
    }
    try {
      await input.persistence.finish(claim.sessionId, succeeded);
    } catch {
      logger.error(logCodes.workerUploadCleanupFailed, { outcome: "failed" });
    }
  }
}

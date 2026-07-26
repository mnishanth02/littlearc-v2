import type { FileValidationPersistence } from "@littlearc/database";
import { parseUuidV7, type UuidV7 } from "@littlearc/domain";
import { logCodes, type SafeLogger } from "@littlearc/observability";
import { type JobWithMetadata, PgBoss, type QueueResult } from "pg-boss";
import type { ValidationWorkspaceManager } from "../file-validation/handler.js";

export const fileValidationQueueName = "file-validation-v1";
export const fileValidationDeadLetterQueueName = "file-validation-dead-v1";
export const fileValidationQueueDefinition = {
  deadLetter: fileValidationDeadLetterQueueName,
  deleteAfterSeconds: 7 * 24 * 60 * 60,
  expireInSeconds: 15 * 60,
  heartbeatSeconds: 60,
  policy: "standard",
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 15 * 60,
  retryLimit: 5,
} as const;

type QueuePayload = { readonly fileObjectId: string };

export function createFileValidationQueueRuntime(options: {
  readonly concurrency: number;
  readonly databaseUrl: string;
  readonly handle: (
    fileObjectId: UuidV7,
    signal?: AbortSignal,
  ) => Promise<"noop" | "ready" | "rejected">;
  readonly logger: SafeLogger;
  readonly persistence: FileValidationPersistence;
  readonly workspace: ValidationWorkspaceManager & {
    readonly initialize: () => Promise<void>;
    readonly scavenge: (olderThan: Date) => Promise<ReadonlyArray<UuidV7>>;
  };
}) {
  const boss = new PgBoss({
    connectionString: options.databaseUrl,
    createSchema: false,
    migrate: false,
    schema: "pgboss",
    supervise: true,
  });
  let dispatchTimer: ReturnType<typeof setInterval> | undefined;
  let recoveryTimer: ReturnType<typeof setInterval> | undefined;
  let dispatching = false;
  let recovering = false;

  const send = async (fileObjectId: UuidV7, jobId: UuidV7 = fileObjectId): Promise<boolean> => {
    const sent = await boss.send(
      fileValidationQueueName,
      { fileObjectId },
      {
        deadLetter: fileValidationDeadLetterQueueName,
        id: jobId,
        singletonKey: fileObjectId,
      },
    );
    if (sent) {
      return true;
    }
    const existing = await boss.findJobs<QueuePayload>(fileValidationQueueName, { id: jobId });
    return existing.length > 0;
  };

  const dispatch = async (): Promise<void> => {
    const claims = await options.persistence.claimDispatches(20);
    for (const claim of claims) {
      let succeeded = false;
      try {
        succeeded = await send(claim.fileObjectId);
      } catch {
        options.logger.error(logCodes.workerFileValidationDispatchFailed, {
          outcome: "dispatch_failed",
        });
      }
      await options.persistence.finishDispatch(claim.eventId, succeeded);
    }
  };

  const recover = async (): Promise<void> => {
    const scavenged = await options.workspace.scavenge(new Date(Date.now() - 20 * 60 * 1000));
    if (scavenged.length > 0) {
      options.logger.info(logCodes.workerFileValidationScavenged, { outcome: "scavenged" });
    }
    const stale = await options.persistence.listStale(20);
    for (const item of stale) {
      try {
        await options.workspace.cleanup(item.attemptId);
      } catch {
        options.logger.error(logCodes.workerFileValidationCleanupFailed, {
          outcome: "cleanup_failed",
        });
        continue;
      }
      if (await options.persistence.recover(item.fileObjectId, item.attemptId)) {
        await send(item.fileObjectId, item.attemptId);
      }
    }
  };

  return {
    async start(): Promise<void> {
      await options.workspace.initialize();
      await recover();
      await boss.start();
      if ((await boss.schemaVersion()) !== 37) {
        throw new Error("pg-boss schema version does not match the reviewed VLT-05 version.");
      }
      const drift = await boss.detectSchemaDrift();
      if (!drift.ok) {
        throw new Error("pg-boss schema drift was detected.");
      }
      await assertQueue(boss, fileValidationDeadLetterQueueName);
      await assertQueue(boss, fileValidationQueueName);
      const workOptions = {
        batchSize: 1,
        heartbeatRefreshSeconds: 30,
        includeMetadata: true,
        localConcurrency: options.concurrency,
        pollingIntervalSeconds: 2,
      } as const;
      await boss.work<QueuePayload, void, typeof workOptions>(
        fileValidationQueueName,
        workOptions,
        async (jobs: JobWithMetadata<QueuePayload>[]) => {
          for (const job of jobs) {
            const fileObjectId = parsePayload(job.data);
            const started = Date.now();
            try {
              const result = await options.handle(fileObjectId, job.signal);
              if (result !== "noop") {
                options.logger.info(logCodes.workerFileValidationCompleted, {
                  durationMs: Date.now() - started,
                  outcome: result,
                });
              }
            } catch (error) {
              if (job.retryCount >= job.retryLimit) {
                const failed = await options.persistence.failExhausted(fileObjectId);
                if (failed) {
                  options.logger.error(logCodes.workerFileValidationFailed, {
                    outcome: "failed",
                  });
                }
              }
              options.logger.warn(logCodes.workerFileValidationRetrying, {
                outcome: "retrying",
              });
              throw error;
            }
          }
        },
      );
      await dispatch();
      dispatchTimer = setInterval(() => {
        if (dispatching) {
          return;
        }
        dispatching = true;
        void dispatch()
          .catch(() => {
            options.logger.error(logCodes.workerFileValidationDispatchFailed, {
              outcome: "dispatch_failed",
            });
          })
          .finally(() => {
            dispatching = false;
          });
      }, 5_000);
      recoveryTimer = setInterval(() => {
        if (recovering) {
          return;
        }
        recovering = true;
        void recover()
          .catch(() => {
            options.logger.error(logCodes.workerFileValidationCleanupFailed, {
              outcome: "cleanup_failed",
            });
          })
          .finally(() => {
            recovering = false;
          });
      }, 60_000);
    },
    async stop(): Promise<void> {
      if (dispatchTimer) {
        clearInterval(dispatchTimer);
      }
      if (recoveryTimer) {
        clearInterval(recoveryTimer);
      }
      await boss.offWork(fileValidationQueueName, { wait: true });
      await boss.stop({ graceful: true, timeout: 30_000 });
    },
  };
}

async function assertQueue(boss: PgBoss, name: string): Promise<QueueResult> {
  const queue = await boss.getQueue(name);
  if (!queue) {
    throw new Error(`Required queue ${name} is not prepared.`);
  }
  if (
    name === fileValidationQueueName &&
    (queue.deadLetter !== fileValidationQueueDefinition.deadLetter ||
      queue.retryLimit !== fileValidationQueueDefinition.retryLimit ||
      queue.expireInSeconds !== fileValidationQueueDefinition.expireInSeconds ||
      queue.heartbeatSeconds !== fileValidationQueueDefinition.heartbeatSeconds)
  ) {
    throw new Error("File-validation queue definition drift was detected.");
  }
  return queue;
}

function parsePayload(value: unknown): UuidV7 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Validation job payload is invalid.");
  }
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "fileObjectId") {
    throw new Error("Validation job payload contains unsupported fields.");
  }
  return parseUuidV7((value as QueuePayload).fileObjectId, "fileObjectId");
}

import type { FilePreviewPersistence } from "@littlearc/database";
import { parseUuidV7, type UuidV7 } from "@littlearc/domain";
import { logCodes, type SafeLogger } from "@littlearc/observability";
import type { EncryptedObjectStorage } from "@littlearc/storage";
import { type JobWithMetadata, PgBoss, type QueueResult } from "pg-boss";
import type { PreviewWorkspaceManager } from "../file-preview/handler.js";

export const filePreviewQueueName = "file-preview-v1";
export const filePreviewDeadLetterQueueName = "file-preview-dead-v1";
export const filePreviewQueueDefinition = {
  deadLetter: filePreviewDeadLetterQueueName,
  deleteAfterSeconds: 7 * 24 * 60 * 60,
  expireInSeconds: 15 * 60,
  heartbeatSeconds: 60,
  policy: "standard",
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 15 * 60,
  retryLimit: 5,
} as const;

type QueuePayload = { readonly derivativeId: string };

export function createFilePreviewQueueRuntime(options: {
  readonly databaseUrl: string;
  readonly handle: (
    derivativeId: UuidV7,
    signal?: AbortSignal,
  ) => Promise<"failed" | "noop" | "ready">;
  readonly logger: SafeLogger;
  readonly persistence: FilePreviewPersistence;
  readonly storage: EncryptedObjectStorage;
  readonly workspace: PreviewWorkspaceManager & {
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

  const send = async (derivativeId: UuidV7, jobId: UuidV7 = derivativeId) => {
    const sent = await boss.send(
      filePreviewQueueName,
      { derivativeId },
      {
        deadLetter: filePreviewDeadLetterQueueName,
        id: jobId,
        singletonKey: derivativeId,
      },
    );
    if (sent) {
      return true;
    }
    return (await boss.findJobs<QueuePayload>(filePreviewQueueName, { id: jobId })).length > 0;
  };

  const dispatch = async () => {
    await options.persistence.ensureCandidates(20);
    const claims = await options.persistence.claimDispatches(20);
    for (const claim of claims) {
      let succeeded = false;
      try {
        succeeded = await send(claim.derivativeId);
      } catch {
        options.logger.error(logCodes.workerFilePreviewDispatchFailed, {
          outcome: "dispatch_failed",
        });
      }
      await options.persistence.finishDispatch(claim.eventId, succeeded);
    }
  };

  const recover = async () => {
    const stale = await options.persistence.listStale(20);
    for (const item of stale) {
      try {
        if (item.storageKey) {
          await options.storage.deleteObject(item.storageKey);
        }
        await options.workspace.cleanup(item.attemptId);
      } catch {
        options.logger.error(logCodes.workerFilePreviewCleanupFailed, {
          outcome: "cleanup_failed",
        });
        continue;
      }
      if (await options.persistence.recover(item.derivativeId, item.attemptId)) {
        await send(item.derivativeId, item.attemptId);
      }
    }
    const scavenged = await options.workspace.scavenge(new Date(Date.now() - 20 * 60 * 1000));
    if (scavenged.length > 0) {
      options.logger.info(logCodes.workerFilePreviewScavenged, { outcome: "scavenged" });
    }
  };

  return {
    async start() {
      await options.workspace.initialize();
      await boss.start();
      if ((await boss.schemaVersion()) !== 37 || !(await boss.detectSchemaDrift()).ok) {
        throw new Error("pg-boss does not match the reviewed VLT-05-F3 schema boundary.");
      }
      await assertQueue(boss, filePreviewDeadLetterQueueName);
      await assertQueue(boss, filePreviewQueueName);
      await recover();
      const workOptions = {
        batchSize: 1,
        heartbeatRefreshSeconds: 30,
        includeMetadata: true,
        localConcurrency: 1,
        pollingIntervalSeconds: 2,
      } as const;
      await boss.work<QueuePayload, void, typeof workOptions>(
        filePreviewQueueName,
        workOptions,
        async (jobs: JobWithMetadata<QueuePayload>[]) => {
          for (const job of jobs) {
            const derivativeId = parsePayload(job.data);
            const started = Date.now();
            try {
              const outcome = await options.handle(derivativeId, job.signal);
              if (outcome !== "noop") {
                options.logger.info(logCodes.workerFilePreviewCompleted, {
                  durationMs: Date.now() - started,
                  outcome,
                });
              }
            } catch (error) {
              if (job.retryCount >= job.retryLimit) {
                if (await options.persistence.failExhausted(derivativeId)) {
                  options.logger.error(logCodes.workerFilePreviewFailed, {
                    outcome: "failed",
                  });
                }
              }
              options.logger.warn(logCodes.workerFilePreviewRetrying, {
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
            options.logger.error(logCodes.workerFilePreviewDispatchFailed, {
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
            options.logger.error(logCodes.workerFilePreviewCleanupFailed, {
              outcome: "cleanup_failed",
            });
          })
          .finally(() => {
            recovering = false;
          });
      }, 60_000);
    },
    async stop() {
      if (dispatchTimer) {
        clearInterval(dispatchTimer);
      }
      if (recoveryTimer) {
        clearInterval(recoveryTimer);
      }
      await boss.offWork(filePreviewQueueName, { wait: true });
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
    name === filePreviewQueueName &&
    (queue.deadLetter !== filePreviewQueueDefinition.deadLetter ||
      queue.retryLimit !== filePreviewQueueDefinition.retryLimit ||
      queue.expireInSeconds !== filePreviewQueueDefinition.expireInSeconds ||
      queue.heartbeatSeconds !== filePreviewQueueDefinition.heartbeatSeconds)
  ) {
    throw new Error("File-preview queue definition drift was detected.");
  }
  return queue;
}

export function parseFilePreviewPayload(value: unknown): UuidV7 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Preview job payload is invalid.");
  }
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "derivativeId") {
    throw new Error("Preview job payload contains unsupported fields.");
  }
  return parseUuidV7((value as QueuePayload).derivativeId, "derivativeId");
}

const parsePayload = parseFilePreviewPayload;

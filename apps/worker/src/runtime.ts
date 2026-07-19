import { databaseFoundationReadiness } from "@littlearc/database/readiness";
import type { WorkerConfig } from "./config.js";

export type WorkerLogger = {
  readonly info: (event: WorkerLogEvent) => void;
};

export type WorkerLogEvent = {
  readonly code: "worker_started" | "worker_heartbeat" | "worker_stopped";
  readonly appEnv: WorkerConfig["appEnv"];
  readonly databaseMigrationVersion: typeof databaseFoundationReadiness.migrationVersion;
  readonly queue: WorkerConfig["queueConnectionMode"];
  readonly retryPolicy: "fnd_05_outbox_foundation";
  readonly deadLetterPolicy: "fnd_05_outbox_foundation";
};

export type WorkerRuntime = {
  readonly start: () => void;
  readonly stop: () => void;
};

type Timer = ReturnType<typeof setInterval>;

export function createWorkerRuntime(config: WorkerConfig, logger: WorkerLogger): WorkerRuntime {
  let heartbeatTimer: Timer | undefined;

  const eventBase = {
    appEnv: config.appEnv,
    databaseMigrationVersion: databaseFoundationReadiness.migrationVersion,
    deadLetterPolicy: "fnd_05_outbox_foundation",
    queue: config.queueConnectionMode,
    retryPolicy: "fnd_05_outbox_foundation",
  } as const;

  return {
    start() {
      logger.info({
        ...eventBase,
        code: "worker_started",
      });

      heartbeatTimer = setInterval(() => {
        logger.info({
          ...eventBase,
          code: "worker_heartbeat",
        });
      }, config.heartbeatIntervalMs);
    },
    stop() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = undefined;
      }

      logger.info({
        ...eventBase,
        code: "worker_stopped",
      });
    },
  };
}

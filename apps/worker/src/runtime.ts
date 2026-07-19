import { logCodes, type SafeLogger } from "@littlearc/observability";
import type { WorkerConfig } from "./config.js";

export type WorkerRuntime = {
  readonly start: () => void;
  readonly stop: () => void;
};

type Timer = ReturnType<typeof setInterval>;

export function createWorkerRuntime(config: WorkerConfig, logger: SafeLogger): WorkerRuntime {
  let heartbeatTimer: Timer | undefined;

  return {
    start() {
      logger.info(logCodes.workerStarted, { outcome: "started" });

      heartbeatTimer = setInterval(() => {
        logger.info(logCodes.workerHeartbeat, { outcome: "heartbeat" });
      }, config.heartbeatIntervalMs);
    },
    stop() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = undefined;
      }

      logger.info(logCodes.workerStopped, { outcome: "stopped" });
    },
  };
}

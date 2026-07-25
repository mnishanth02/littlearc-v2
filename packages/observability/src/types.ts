export const serviceNames = ["api", "worker", "mobile", "ops-web"] as const;
export type ServiceName = (typeof serviceNames)[number];

export const runtimeEnvironments = ["local", "staging", "production"] as const;
export type RuntimeEnvironment = (typeof runtimeEnvironments)[number];

export const logLevels = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof logLevels)[number];

export const logCodes = {
  apiRequestCompleted: "api.request.completed",
  workerHeartbeat: "worker.runtime.heartbeat",
  workerStarted: "worker.runtime.started",
  workerStopped: "worker.runtime.stopped",
  workerUploadCleanupFailed: "worker.upload_cleanup.failed",
} as const;

export type LogCode = (typeof logCodes)[keyof typeof logCodes];

export type RequestOutcome = "client_error" | "server_error" | "success";

export type LogContextMap = {
  readonly [logCodes.apiRequestCompleted]: {
    readonly requestId: string;
    readonly durationMs: number;
    readonly outcome: RequestOutcome;
  };
  readonly [logCodes.workerStarted]: {
    readonly outcome: "started";
  };
  readonly [logCodes.workerHeartbeat]: {
    readonly outcome: "heartbeat";
  };
  readonly [logCodes.workerStopped]: {
    readonly outcome: "stopped";
  };
  readonly [logCodes.workerUploadCleanupFailed]: {
    readonly outcome: "failed";
  };
};

export type SafeLogRecord = {
  readonly timestamp: string;
  readonly severity: LogLevel;
  readonly service: ServiceName;
  readonly version: string;
  readonly environment: RuntimeEnvironment;
  readonly code: LogCode;
  readonly requestId?: string;
  readonly durationMs?: number;
  readonly outcome: LogContextMap[LogCode]["outcome"];
};

export const errorCodes = {
  apiRequestFailed: "api.request.failed",
  mobileUnhandled: "mobile.runtime.unhandled",
  observabilityDeliveryFailed: "observability.delivery.failed",
  opsWebUnhandled: "ops-web.runtime.unhandled",
  workerRuntimeFailed: "worker.runtime.failed",
} as const;

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];

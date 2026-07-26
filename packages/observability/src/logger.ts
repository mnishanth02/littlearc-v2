import { assertNoSensitiveCanary, type SensitiveCanary } from "./canary.js";
import {
  type LogCode,
  type LogContextMap,
  type LogLevel,
  logCodes,
  type RuntimeEnvironment,
  type SafeLogRecord,
  type ServiceName,
} from "./types.js";

const maxDurationMs = 86_400_000;
const safeIdentifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const safeVersion = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/;

export type LogSink = (record: SafeLogRecord) => void;

export type SafeLogger = {
  readonly debug: <Code extends LogCode>(code: Code, context: LogContextMap[Code]) => SafeLogRecord;
  readonly error: <Code extends LogCode>(code: Code, context: LogContextMap[Code]) => SafeLogRecord;
  readonly info: <Code extends LogCode>(code: Code, context: LogContextMap[Code]) => SafeLogRecord;
  readonly warn: <Code extends LogCode>(code: Code, context: LogContextMap[Code]) => SafeLogRecord;
};

export type SafeLoggerOptions = {
  readonly service: ServiceName;
  readonly version: string;
  readonly environment: RuntimeEnvironment;
  readonly sink?: LogSink;
  readonly now?: () => Date;
  readonly canaries?: ReadonlyArray<SensitiveCanary>;
};

export function createSafeLogger(options: SafeLoggerOptions): SafeLogger {
  if (!safeVersion.test(options.version)) {
    throw new Error("Observability version must be a stable identifier");
  }

  const emit = <Code extends LogCode>(
    severity: LogLevel,
    code: Code,
    context: LogContextMap[Code],
  ): SafeLogRecord => {
    const record = buildRecord(options, severity, code, context);
    assertNoSensitiveCanary(record, options.canaries ?? []);
    options.sink?.(record);
    return record;
  };

  return {
    debug: (code, context) => emit("debug", code, context),
    error: (code, context) => emit("error", code, context),
    info: (code, context) => emit("info", code, context),
    warn: (code, context) => emit("warn", code, context),
  };
}

function buildRecord<Code extends LogCode>(
  options: SafeLoggerOptions,
  severity: LogLevel,
  code: Code,
  context: LogContextMap[Code],
): SafeLogRecord {
  assertCodeMatchesService(code, options.service);

  const base = {
    code,
    environment: options.environment,
    service: options.service,
    severity,
    timestamp: (options.now ?? (() => new Date()))().toISOString(),
    version: options.version,
  } as const;

  if (code === logCodes.apiRequestCompleted) {
    const requestContext = context as LogContextMap[typeof logCodes.apiRequestCompleted];
    if (!safeIdentifier.test(requestContext.requestId)) {
      throw new Error("Request ID must be a stable opaque identifier");
    }

    return {
      ...base,
      durationMs: normalizeDuration(requestContext.durationMs),
      outcome: requestContext.outcome,
      requestId: requestContext.requestId,
    };
  }

  if (code === logCodes.workerStarted) {
    return { ...base, outcome: "started" };
  }
  if (code === logCodes.workerHeartbeat) {
    return { ...base, outcome: "heartbeat" };
  }
  if (code === logCodes.workerStopped) {
    return { ...base, outcome: "stopped" };
  }
  if (code === logCodes.workerUploadCleanupFailed) {
    return { ...base, outcome: "failed" };
  }
  if (code === logCodes.workerFileValidationCompleted) {
    const validationContext =
      context as LogContextMap[typeof logCodes.workerFileValidationCompleted];
    return {
      ...base,
      durationMs: normalizeDuration(validationContext.durationMs),
      outcome: validationContext.outcome,
    };
  }
  if (code === logCodes.workerFileValidationRetrying) {
    return { ...base, outcome: "retrying" };
  }
  if (code === logCodes.workerFileValidationFailed) {
    return { ...base, outcome: "failed" };
  }
  if (code === logCodes.workerFileValidationCleanupFailed) {
    return { ...base, outcome: "cleanup_failed" };
  }
  if (code === logCodes.workerFileValidationScavenged) {
    return { ...base, outcome: "scavenged" };
  }
  if (code === logCodes.workerFileValidationDispatchFailed) {
    return { ...base, outcome: "dispatch_failed" };
  }

  return assertNever(code);
}

function assertCodeMatchesService(code: LogCode, service: ServiceName): void {
  const expectedService = code === logCodes.apiRequestCompleted ? "api" : "worker";
  if (service !== expectedService) {
    throw new Error(`Log code ${code} does not belong to service ${service}`);
  }
}

function normalizeDuration(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error("Duration must be a finite non-negative number");
  }

  return Math.min(Math.round(durationMs), maxDurationMs);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported log code: ${String(value)}`);
}

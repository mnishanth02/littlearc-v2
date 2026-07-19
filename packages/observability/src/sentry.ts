import { assertNoSensitiveCanary, type SensitiveCanary } from "./canary.js";
import { type ErrorCode, errorCodes, type RuntimeEnvironment, type ServiceName } from "./types.js";

const allowedErrorCodes = new Set<ErrorCode>(Object.values(errorCodes));
const safeIdentifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const safeVersion = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/;

export type SafeSentryEvent = {
  readonly event_id?: string;
  readonly timestamp: number;
  readonly level: "error";
  readonly logger: "littlearc";
  readonly platform: "javascript" | "node";
  readonly release: string;
  readonly environment: RuntimeEnvironment;
  readonly tags: {
    readonly error_code: ErrorCode;
    readonly service: ServiceName;
    readonly request_id?: string;
    readonly job_id?: string;
  };
  readonly exception: {
    readonly values: ReadonlyArray<{
      readonly type: "LittleArcError";
      readonly value: ErrorCode;
    }>;
  };
};

export type SentryBeforeSend = (event: unknown) => SafeSentryEvent | null;

export type SentryScrubberOptions = {
  readonly service: ServiceName;
  readonly environment: RuntimeEnvironment;
  readonly version: string;
  readonly runtime?: "client" | "server";
  readonly canaries?: ReadonlyArray<SensitiveCanary>;
  readonly now?: () => Date;
};

export type ErrorReporter = {
  readonly capture: (
    code: ErrorCode,
    context?: { readonly requestId?: string; readonly jobId?: string },
  ) => boolean;
};

export function createSentryBeforeSend(options: SentryScrubberOptions): SentryBeforeSend {
  if (!safeVersion.test(options.version)) {
    throw new Error("Sentry release must be a stable identifier");
  }

  return (event) => {
    const input = asRecord(event);
    const tags = asRecord(input?.tags);
    const errorCode = tags?.error_code;

    if (typeof errorCode !== "string" || !allowedErrorCodes.has(errorCode as ErrorCode)) {
      return null;
    }

    const requestId = readIdentifier(tags?.request_id);
    const jobId = readIdentifier(tags?.job_id);
    const eventId = readIdentifier(input?.event_id);
    const timestamp =
      typeof input?.timestamp === "number" && Number.isFinite(input.timestamp)
        ? input.timestamp
        : (options.now ?? (() => new Date()))().getTime() / 1_000;

    const safeEvent: SafeSentryEvent = {
      environment: options.environment,
      exception: {
        values: [{ type: "LittleArcError", value: errorCode as ErrorCode }],
      },
      level: "error",
      logger: "littlearc",
      platform:
        options.runtime === "client" || (!options.runtime && options.service === "mobile")
          ? "javascript"
          : "node",
      release: options.version,
      tags: {
        error_code: errorCode as ErrorCode,
        service: options.service,
        ...(requestId ? { request_id: requestId } : {}),
        ...(jobId ? { job_id: jobId } : {}),
      },
      timestamp,
      ...(eventId ? { event_id: eventId } : {}),
    };

    assertNoSensitiveCanary(safeEvent, options.canaries ?? []);
    return safeEvent;
  };
}

export function createErrorReporter(
  options: SentryScrubberOptions & { readonly sink?: (event: SafeSentryEvent) => void },
): ErrorReporter {
  const beforeSend = createSentryBeforeSend(options);

  return {
    capture(code, context = {}) {
      if (!options.sink) {
        return false;
      }

      const event = beforeSend({
        tags: {
          error_code: code,
          ...(context.requestId ? { request_id: context.requestId } : {}),
          ...(context.jobId ? { job_id: context.jobId } : {}),
        },
      });

      if (!event) {
        return false;
      }

      options.sink(event);
      return true;
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readIdentifier(value: unknown): string | undefined {
  return typeof value === "string" && safeIdentifier.test(value) ? value : undefined;
}

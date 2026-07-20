import { describe, expect, it, vi } from "vitest";
import { createSafeLogger } from "./logger.js";
import { sensitiveCanaries } from "./test-canaries.js";
import { logCodes, type SafeLogRecord } from "./types.js";

describe("safe structured logger", () => {
  it("emits the fixed JSON record shape and clamps duration", () => {
    const records: SafeLogRecord[] = [];
    const logger = createSafeLogger({
      canaries: sensitiveCanaries,
      environment: "staging",
      now: () => new Date("2026-07-19T10:00:00.000Z"),
      service: "api",
      sink: (record) => records.push(record),
      version: "0.0.0",
    });

    const untypedContext = {
      durationMs: 90_000_000,
      outcome: "success",
      requestId: "request-01",
      secret: sensitiveCanaries[4].value,
    } as never;
    logger.info(logCodes.apiRequestCompleted, untypedContext);

    expect(records).toEqual([
      {
        code: "api.request.completed",
        durationMs: 86_400_000,
        environment: "staging",
        outcome: "success",
        requestId: "request-01",
        service: "api",
        severity: "info",
        timestamp: "2026-07-19T10:00:00.000Z",
        version: "0.0.0",
      },
    ]);
    expect(JSON.stringify(records)).not.toContain(sensitiveCanaries[4].value);
  });

  it("rejects invalid identifiers and durations before sink delivery", () => {
    const sink = vi.fn();
    const logger = createSafeLogger({
      environment: "local",
      service: "api",
      sink,
      version: "0.0.0",
    });

    expect(() =>
      logger.info(logCodes.apiRequestCompleted, {
        durationMs: -1,
        outcome: "server_error",
        requestId: "request-01",
      }),
    ).toThrow("Duration");
    expect(() =>
      logger.info(logCodes.apiRequestCompleted, {
        durationMs: 1,
        outcome: "server_error",
        requestId: "request with spaces",
      }),
    ).toThrow("Request ID");
    expect(sink).not.toHaveBeenCalled();
  });

  it("rejects a stable code used by the wrong service", () => {
    const logger = createSafeLogger({
      environment: "local",
      service: "mobile",
      version: "0.0.0",
    });

    expect(() => logger.info(logCodes.workerStarted, { outcome: "started" })).toThrow(
      "does not belong",
    );
  });

  it("emits worker lifecycle codes without arbitrary payload fields", () => {
    const records: SafeLogRecord[] = [];
    const logger = createSafeLogger({
      environment: "local",
      service: "worker",
      sink: (record) => records.push(record),
      version: "0.0.0",
    });

    logger.info(logCodes.workerStarted, { outcome: "started" });
    logger.info(logCodes.workerHeartbeat, { outcome: "heartbeat" });
    logger.info(logCodes.workerStopped, { outcome: "stopped" });

    expect(records.map(({ code, outcome }) => ({ code, outcome }))).toEqual([
      { code: "worker.runtime.started", outcome: "started" },
      { code: "worker.runtime.heartbeat", outcome: "heartbeat" },
      { code: "worker.runtime.stopped", outcome: "stopped" },
    ]);
  });
});

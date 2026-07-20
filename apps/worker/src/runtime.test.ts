import { createSafeLogger, type SafeLogRecord } from "@littlearc/observability";
import { describe, expect, it, vi } from "vitest";
import { loadWorkerConfig } from "./config.js";
import { createWorkerRuntime } from "./runtime.js";

describe("worker skeleton", () => {
  it("loads safe local configuration without a database URL", () => {
    expect(loadWorkerConfig({ APP_ENV: "local" })).toEqual({
      appEnv: "local",
      heartbeatIntervalMs: 30_000,
      queueConnectionMode: "deferred",
    });
  });

  it("logs lifecycle events without job payload data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T10:00:00.000Z"));
    const events: SafeLogRecord[] = [];
    const runtime = createWorkerRuntime(
      loadWorkerConfig({ APP_ENV: "local" }),
      createSafeLogger({
        environment: "local",
        service: "worker",
        sink: (event) => events.push(event),
        version: "0.0.0",
      }),
    );

    runtime.start();
    vi.advanceTimersByTime(30_000);
    runtime.stop();

    expect(events).toEqual([
      {
        code: "worker.runtime.started",
        environment: "local",
        outcome: "started",
        service: "worker",
        severity: "info",
        timestamp: "2026-07-19T10:00:00.000Z",
        version: "0.0.0",
      },
      {
        code: "worker.runtime.heartbeat",
        environment: "local",
        outcome: "heartbeat",
        service: "worker",
        severity: "info",
        timestamp: "2026-07-19T10:00:30.000Z",
        version: "0.0.0",
      },
      {
        code: "worker.runtime.stopped",
        environment: "local",
        outcome: "stopped",
        service: "worker",
        severity: "info",
        timestamp: "2026-07-19T10:00:30.000Z",
        version: "0.0.0",
      },
    ]);

    vi.useRealTimers();
  });
});

import { describe, expect, it, vi } from "vitest";
import { loadWorkerConfig } from "./config.js";
import { createWorkerRuntime, type WorkerLogEvent } from "./runtime.js";

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
    const events: WorkerLogEvent[] = [];
    const runtime = createWorkerRuntime(loadWorkerConfig({ APP_ENV: "local" }), {
      info(event) {
        events.push(event);
      },
    });

    runtime.start();
    vi.advanceTimersByTime(30_000);
    runtime.stop();

    expect(events).toEqual([
      {
        appEnv: "local",
        code: "worker_started",
        deadLetterPolicy: "fnd_05",
        queue: "deferred",
        retryPolicy: "fnd_05",
      },
      {
        appEnv: "local",
        code: "worker_heartbeat",
        deadLetterPolicy: "fnd_05",
        queue: "deferred",
        retryPolicy: "fnd_05",
      },
      {
        appEnv: "local",
        code: "worker_stopped",
        deadLetterPolicy: "fnd_05",
        queue: "deferred",
        retryPolicy: "fnd_05",
      },
    ]);

    vi.useRealTimers();
  });
});

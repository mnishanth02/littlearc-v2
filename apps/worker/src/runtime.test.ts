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
      uploadCleanupIntervalMs: 60_000,
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

  it("claims and aborts expired multipart uploads without receiving key material", async () => {
    vi.useFakeTimers();
    const claim = vi.fn(async () => [
      {
        objectKey:
          "objects/019f8000-0000-7000-8000-000000000001/019f8000-0000-7000-8000-000000000002.lac",
        providerUploadId: "provider-upload",
        sessionId: "019f8000-0000-7000-8000-000000000002",
      },
    ]);
    const finish = vi.fn(async () => undefined);
    const abortMultipart = vi.fn(async () => undefined);
    const runtime = createWorkerRuntime(
      loadWorkerConfig({ APP_ENV: "local" }),
      createSafeLogger({
        environment: "local",
        service: "worker",
        sink: () => undefined,
        version: "0.0.0",
      }),
      {
        persistence: { claim, finish } as never,
        storage: { abortMultipart } as never,
      },
    );

    runtime.start();
    await vi.advanceTimersByTimeAsync(60_000);
    runtime.stop();

    expect(claim).toHaveBeenCalledWith(20);
    expect(abortMultipart).toHaveBeenCalledWith({
      objectKey:
        "objects/019f8000-0000-7000-8000-000000000001/019f8000-0000-7000-8000-000000000002.lac",
      providerUploadId: "provider-upload",
    });
    expect(finish).toHaveBeenCalledWith("019f8000-0000-7000-8000-000000000002", true);
    vi.useRealTimers();
  });

  it("isolates cleanup failures, schedules retry, and continues later claims", async () => {
    vi.useFakeTimers();
    const events: SafeLogRecord[] = [];
    const claims = [
      {
        objectKey:
          "objects/019f8000-0000-7000-8000-000000000001/019f8000-0000-7000-8000-000000000002.lac",
        providerUploadId: "provider-upload-fails",
        sessionId: "019f8000-0000-7000-8000-000000000002",
      },
      {
        objectKey:
          "objects/019f8000-0000-7000-8000-000000000003/019f8000-0000-7000-8000-000000000004.lac",
        providerUploadId: "provider-upload-passes",
        sessionId: "019f8000-0000-7000-8000-000000000004",
      },
    ];
    const finish = vi.fn(async (sessionId: string) => {
      if (sessionId === claims[0]?.sessionId) {
        throw new Error("Synthetic persistence failure");
      }
    });
    const abortMultipart = vi.fn(async ({ providerUploadId }) => {
      if (providerUploadId === "provider-upload-fails") {
        throw new Error("Synthetic provider failure");
      }
    });
    const runtime = createWorkerRuntime(
      loadWorkerConfig({ APP_ENV: "local" }),
      createSafeLogger({
        environment: "local",
        service: "worker",
        sink: (event) => events.push(event),
        version: "0.0.0",
      }),
      {
        persistence: {
          claim: vi.fn(async () => claims),
          finish,
        } as never,
        storage: { abortMultipart } as never,
      },
    );

    runtime.start();
    await vi.advanceTimersByTimeAsync(60_000);
    runtime.stop();

    expect(abortMultipart).toHaveBeenCalledTimes(2);
    expect(finish).toHaveBeenNthCalledWith(1, claims[0]?.sessionId, false);
    expect(finish).toHaveBeenNthCalledWith(2, claims[1]?.sessionId, true);
    expect(events).toContainEqual(
      expect.objectContaining({
        code: "worker.upload_cleanup.failed",
        outcome: "failed",
        severity: "error",
      }),
    );
    vi.useRealTimers();
  });
});

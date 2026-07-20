import { describe, expect, it, vi } from "vitest";
import { createErrorReporter, createSentryBeforeSend } from "./sentry.js";
import { sensitiveCanaries } from "./test-canaries.js";

describe("Sentry privacy guards", () => {
  it("rebuilds client and server events from a positive allowlist", () => {
    const beforeSend = createSentryBeforeSend({
      canaries: sensitiveCanaries,
      environment: "staging",
      now: () => new Date("2026-07-19T10:00:00.000Z"),
      service: "api",
      version: "0.0.0",
    });
    const safe = beforeSend({
      attachments: [sensitiveCanaries[5].value],
      breadcrumbs: [{ message: sensitiveCanaries[3].value }],
      contexts: { response: { body: sensitiveCanaries[0].value } },
      event_id: "event-01",
      extra: { rawError: sensitiveCanaries[6].value },
      message: sensitiveCanaries[3].value,
      request: {
        cookies: sensitiveCanaries[4].value,
        data: sensitiveCanaries[3].value,
        headers: { authorization: sensitiveCanaries[4].value },
        query_string: `email=${sensitiveCanaries[1].value}`,
        url: sensitiveCanaries[5].value,
      },
      tags: {
        error_code: "api.request.failed",
        request_id: "request-01",
        unsafe: sensitiveCanaries[2].value,
      },
      user: { email: sensitiveCanaries[1].value, name: sensitiveCanaries[0].value },
    });

    expect(safe).toEqual({
      environment: "staging",
      event_id: "event-01",
      exception: {
        values: [{ type: "LittleArcError", value: "api.request.failed" }],
      },
      level: "error",
      logger: "littlearc",
      platform: "node",
      release: "0.0.0",
      tags: {
        error_code: "api.request.failed",
        request_id: "request-01",
        service: "api",
      },
      timestamp: 1_784_455_200,
    });
    for (const canary of sensitiveCanaries) {
      expect(JSON.stringify(safe)).not.toContain(canary.value);
    }

    const clientBeforeSend = createSentryBeforeSend({
      environment: "staging",
      runtime: "client",
      service: "ops-web",
      version: "0.0.0",
    });
    expect(clientBeforeSend({ tags: { error_code: "ops-web.runtime.unhandled" } })).toMatchObject({
      platform: "javascript",
      tags: { service: "ops-web" },
    });
  });

  it("drops events without an allowlisted stable error code", () => {
    const beforeSend = createSentryBeforeSend({
      environment: "local",
      service: "mobile",
      version: "0.0.0",
    });

    expect(beforeSend({ message: sensitiveCanaries[0].value })).toBeNull();
    expect(beforeSend({ tags: { error_code: "raw.dynamic.error" } })).toBeNull();
  });

  it("keeps error delivery disabled until a sink is injected", () => {
    const disabled = createErrorReporter({
      environment: "local",
      service: "ops-web",
      version: "0.0.0",
    });
    expect(disabled.capture("ops-web.runtime.unhandled")).toBe(false);

    const sink = vi.fn();
    const enabled = createErrorReporter({
      environment: "staging",
      service: "worker",
      sink,
      version: "0.0.0",
    });
    expect(enabled.capture("worker.runtime.failed", { jobId: "job-01" })).toBe(true);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: {
          error_code: "worker.runtime.failed",
          job_id: "job-01",
          service: "worker",
        },
      }),
    );
  });
});

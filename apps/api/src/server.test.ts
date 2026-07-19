import { describe, expect, it } from "vitest";
import { loadApiConfig } from "./config.js";
import { createApiServer } from "./server.js";

describe("API skeleton", () => {
  it("serves liveness with request IDs", async () => {
    const server = await createApiServer(loadApiConfig({ APP_ENV: "local" }));

    const response = await server.inject({
      method: "GET",
      url: "/live",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      appEnv: "local",
      service: "api",
      status: "ok",
    });
    expect(response.json().requestId).toEqual(expect.any(String));
  });

  it("reports deferred dependency readiness without claiming connectivity", async () => {
    const server = await createApiServer(loadApiConfig({ APP_ENV: "local" }));

    const response = await server.inject({
      method: "GET",
      url: "/ready",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      appEnv: "local",
      checks: [
        { name: "auth", owner: "OFF-01", status: "deferred" },
        { name: "database", owner: "FND-05", status: "deferred" },
        { name: "object-storage", owner: "FND-06", status: "deferred" },
        { name: "queue", owner: "FND-05", status: "deferred" },
      ],
      ready: true,
      service: "api",
    });
  });

  it("returns Problem Details for missing routes", async () => {
    const server = await createApiServer(loadApiConfig({ APP_ENV: "local" }));

    const response = await server.inject({
      method: "GET",
      url: "/missing",
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json()).toMatchObject({
      instance: "/missing",
      status: 404,
      title: "Not Found",
      type: "https://littlearc.app/problems/not-found",
    });
  });
});

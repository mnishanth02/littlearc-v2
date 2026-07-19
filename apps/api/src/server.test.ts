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
      databaseFoundation: {
        connection: "deferred",
        migrationExecution: "explicit-release-step",
        migrationVersion: "0001_fnd_05_database_foundation",
        rlsHarness: "policy-source-reviewed",
      },
      checks: [
        { name: "auth", owner: "OFF-01", status: "deferred" },
        { name: "database", owner: "FND-05", status: "foundation-ready" },
        { name: "queue", owner: "FND-05", status: "outbox-foundation-ready" },
        { name: "object-storage", owner: "FND-06", status: "deferred" },
      ],
      ready: true,
      service: "api",
    });
  });

  it("serves shared /v1 contract metadata and OpenAPI", async () => {
    const server = await createApiServer(loadApiConfig({ APP_ENV: "local" }));

    const metadataResponse = await server.inject({
      method: "GET",
      url: "/v1",
    });
    const openApiResponse = await server.inject({
      method: "GET",
      url: "/v1/openapi.json",
    });

    expect(metadataResponse.statusCode).toBe(200);
    expect(metadataResponse.json()).toMatchObject({
      basePath: "/v1",
      name: "littlearc-api",
      version: "0.1.0",
    });
    expect(
      metadataResponse.json().resourceGroups.map((group: { prefix: string }) => group.prefix),
    ).toContain("/v1/sync");
    expect(openApiResponse.statusCode).toBe(200);
    expect(openApiResponse.json()).toMatchObject({
      info: { title: "LittleArc API", version: "0.1.0" },
      openapi: "3.1.0",
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

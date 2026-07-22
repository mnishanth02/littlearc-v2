import { createSafeLogger, type SafeLogRecord } from "@littlearc/observability";
import { describe, expect, it, vi } from "vitest";
import { loadApiConfig } from "./config.js";
import { nextId } from "./owner-onboarding.js";
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

  it("serves Railway health liveness with request IDs", async () => {
    const server = await createApiServer(loadApiConfig({ APP_ENV: "staging" }));

    const response = await server.inject({
      method: "GET",
      url: "/health/live",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      appEnv: "staging",
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

  it("serves Railway readiness health with staging metadata", async () => {
    const server = await createApiServer(loadApiConfig({ APP_ENV: "staging" }));

    const response = await server.inject({
      method: "GET",
      url: "/health/ready",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      appEnv: "staging",
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

  it("mounts the consumer auth handler and forwards multiple session cookies", async () => {
    const config = loadApiConfig({ APP_ENV: "local" });
    const configured = {
      ...config,
      consumerAuth: {
        baseUrl: "http://127.0.0.1:3000",
        databaseUrl: "postgres://synthetic",
        emailFrom: "synthetic@example.test",
        resendApiKey: "synthetic",
        secret: "synthetic-secret-with-at-least-thirty-two-characters",
        trustedOrigins: ["http://127.0.0.1:3000"],
      },
    } as const;
    const server = await createApiServer(configured, undefined, {
      async handler() {
        return new Response(JSON.stringify({ ok: true }), {
          headers: [
            ["content-type", "application/json"],
            ["set-cookie", "session=one; Path=/; HttpOnly"],
            ["set-cookie", "state=two; Path=/; HttpOnly"],
          ],
          status: 200,
        });
      },
    });

    const response = await server.inject({
      method: "POST",
      payload: { email: "CANARY_PARENT@example.test" },
      url: "/v1/auth/email-otp/send-verification-otp",
    });

    expect(response.statusCode).toBe(200);
    expect(response.cookies.map((cookie) => cookie.name)).toEqual(["session", "state"]);
    expect(response.json()).toEqual({ ok: true });

    const readiness = await server.inject({ method: "GET", url: "/ready" });
    expect(readiness.json().checks[0]).toEqual({
      name: "auth",
      owner: "OFF-01",
      status: "foundation-ready",
    });
  });

  it("fails closed for partial consumer auth and social-provider configuration", () => {
    expect(() =>
      loadApiConfig({
        APP_ENV: "local",
        AUTH_BASE_URL: "http://127.0.0.1:3000",
      }),
    ).toThrow("AUTH_TRUSTED_ORIGINS is required");
    expect(() =>
      loadApiConfig({
        APP_ENV: "local",
        APPLE_CLIENT_ID: "synthetic-client",
      }),
    ).toThrow("AUTH_BASE_URL is required");
    expect(() =>
      loadApiConfig({
        APP_ENV: "staging",
        KEY_WRAPPING_SECRET_V1: "synthetic",
        OFF02_ADULT_VERIFICATION_MODE: "synthetic",
      }),
    ).toThrow("restricted to APP_ENV=local");
    expect(() =>
      loadApiConfig({
        APP_ENV: "local",
        KEY_WRAPPING_SECRET_V1: "synthetic",
        OFF02_ADULT_VERIFICATION_MODE: "synthetic",
      }),
    ).toThrow("requires configured consumer authentication");
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

  it("authenticates and validates the atomic OFF-02 onboarding route", async () => {
    const execute = vi.fn(async () => ({
      childDataConsentId: nextId(),
      childId: nextId(),
      householdId: nextId(),
      membershipId: nextId(),
      parentNoticeConsentId: nextId(),
      parentProfileId: nextId(),
      replayed: false,
    }));
    const server = await createApiServer(
      loadApiConfig({ APP_ENV: "local" }),
      undefined,
      undefined,
      {
        command: { execute },
        async getSessionIdentity() {
          return { userId: "synthetic-auth-user" };
        },
      },
    );
    const response = await server.inject({
      headers: { "idempotency-key": nextId() },
      method: "POST",
      payload: {
        adultVerificationAssertion: "synthetic-approved-off-02",
        child: { dateOfBirth: "2020-01-01", preferredName: "Synthetic Child" },
        childDataConsentVersion: "child-data-processing-v1",
        countryCode: "IN",
        parent: { displayName: "Synthetic Parent", relationship: "parent" },
        parentNoticeVersion: "parent-notice-v1",
        timeZone: "Asia/Kolkata",
      },
      url: "/v1/households/onboarding",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ replayed: false });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ identityUserId: "synthetic-auth-user" }),
    );
    expect(JSON.stringify(response.json())).not.toContain("Synthetic Child");
  });

  it("rejects OFF-02 onboarding without a session or valid request", async () => {
    const dependencies = {
      command: { execute: vi.fn() },
      async getSessionIdentity() {
        return null;
      },
    };
    const server = await createApiServer(
      loadApiConfig({ APP_ENV: "local" }),
      undefined,
      undefined,
      dependencies,
    );
    const response = await server.inject({
      headers: { "idempotency-key": nextId() },
      method: "POST",
      payload: {},
      url: "/v1/households/onboarding",
    });
    expect(response.statusCode).toBe(401);
    expect(dependencies.command.execute).not.toHaveBeenCalled();
  });

  it("does not misclassify unexpected database errors as client policy failures", async () => {
    const server = await createApiServer(
      loadApiConfig({ APP_ENV: "local" }),
      undefined,
      undefined,
      {
        command: {
          async execute() {
            throw Object.assign(new Error("synthetic database detail"), { code: "23505" });
          },
        },
        async getSessionIdentity() {
          return { userId: "synthetic-auth-user" };
        },
      },
    );
    const response = await server.inject({
      headers: { "idempotency-key": nextId() },
      method: "POST",
      payload: {
        adultVerificationAssertion: "synthetic-approved-off-02",
        child: { dateOfBirth: "2020-01-01", preferredName: "Synthetic Child" },
        childDataConsentVersion: "child-data-processing-v1",
        countryCode: "IN",
        parent: { displayName: "Synthetic Parent", relationship: "parent" },
        parentNoticeVersion: "parent-notice-v1",
        timeZone: "Asia/Kolkata",
      },
      url: "/v1/households/onboarding",
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("synthetic database detail");
  });

  it("logs request completion through the shared bounded logger", async () => {
    const records: SafeLogRecord[] = [];
    const server = await createApiServer(
      loadApiConfig({ APP_ENV: "staging" }),
      createSafeLogger({
        environment: "staging",
        service: "api",
        sink: (record) => records.push(record),
        version: "0.0.0",
      }),
    );

    await server.inject({ method: "GET", url: "/v1?childName=CANARY_CHILD_AMARA" });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      code: "api.request.completed",
      environment: "staging",
      outcome: "success",
      service: "api",
      severity: "info",
      version: "0.0.0",
    });
    expect(records[0]?.requestId).toEqual(expect.any(String));
    expect(records[0]?.durationMs).toEqual(expect.any(Number));
    expect(JSON.stringify(records)).not.toContain("childName");
    expect(JSON.stringify(records)).not.toContain("CANARY_CHILD_AMARA");
  });
});

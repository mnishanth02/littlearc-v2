import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import type { ConsumerAuth } from "@littlearc/auth";
import { contractMetadata, openApiDocument } from "@littlearc/contracts";
import {
  databaseFoundationReadiness,
  databaseReadinessChecks,
} from "@littlearc/database/readiness";
import {
  createSafeLogger,
  logCodes,
  type RequestOutcome,
  type SafeLogger,
} from "@littlearc/observability";
import Fastify, { type FastifyInstance } from "fastify";
import { registerConsumerAuthRoute } from "./auth-route.js";
import type { ApiConfig } from "./config.js";
import { registerProblemDetails } from "./problem.js";

export type HealthResponse = {
  readonly status: "ok";
  readonly service: "api";
  readonly appEnv: ApiConfig["appEnv"];
  readonly requestId: string;
};

export type ReadinessResponse = {
  readonly ready: true;
  readonly service: "api";
  readonly appEnv: ApiConfig["appEnv"];
  readonly databaseFoundation: typeof databaseFoundationReadiness;
  readonly checks: ReadonlyArray<{
    readonly name: "auth" | "database" | "object-storage" | "queue";
    readonly status: "deferred" | "foundation-ready" | "outbox-foundation-ready";
    readonly owner: string;
  }>;
};

export async function createApiServer(
  config: ApiConfig,
  logger: SafeLogger = createSafeLogger({
    environment: config.appEnv,
    service: "api",
    version: "0.0.0",
  }),
  consumerAuth?: Pick<ConsumerAuth, "handler">,
): Promise<FastifyInstance> {
  const server = Fastify({
    genReqId: () => crypto.randomUUID(),
    logger: false,
  });
  const requestStartTimes = new WeakMap<object, number>();

  server.addHook("onRequest", async (request) => {
    requestStartTimes.set(request, performance.now());
  });
  server.addHook("onResponse", async (request, reply) => {
    const startedAt = requestStartTimes.get(request) ?? performance.now();
    const context = {
      durationMs: performance.now() - startedAt,
      outcome: responseOutcome(reply.statusCode),
      requestId: request.id,
    } as const;

    if (reply.statusCode >= 500) {
      logger.error(logCodes.apiRequestCompleted, context);
    } else if (reply.statusCode >= 400) {
      logger.warn(logCodes.apiRequestCompleted, context);
    } else {
      logger.info(logCodes.apiRequestCompleted, context);
    }
  });

  await server.register(helmet, {
    global: true,
  });
  await server.register(cors, {
    origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
  });

  if (consumerAuth && config.consumerAuth) {
    registerConsumerAuthRoute(server, consumerAuth, config.consumerAuth.baseUrl);
  }

  server.get("/v1", async () => contractMetadata);

  server.get("/v1/openapi.json", async () => openApiDocument);

  server.get(
    "/live",
    async (request): Promise<HealthResponse> => ({
      status: "ok",
      service: "api",
      appEnv: config.appEnv,
      requestId: request.id,
    }),
  );

  server.get(
    "/health/live",
    async (request): Promise<HealthResponse> => ({
      status: "ok",
      service: "api",
      appEnv: config.appEnv,
      requestId: request.id,
    }),
  );

  server.get(
    "/ready",
    async (): Promise<ReadinessResponse> => ({
      ready: true,
      service: "api",
      appEnv: config.appEnv,
      databaseFoundation: databaseFoundationReadiness,
      checks: [
        {
          name: "auth",
          status: consumerAuth ? "foundation-ready" : "deferred",
          owner: "OFF-01",
        },
        ...databaseReadinessChecks,
        { name: "object-storage", status: "deferred", owner: "FND-06" },
      ],
    }),
  );

  server.get(
    "/health/ready",
    async (): Promise<ReadinessResponse> => ({
      ready: true,
      service: "api",
      appEnv: config.appEnv,
      databaseFoundation: databaseFoundationReadiness,
      checks: [
        {
          name: "auth",
          status: consumerAuth ? "foundation-ready" : "deferred",
          owner: "OFF-01",
        },
        ...databaseReadinessChecks,
        { name: "object-storage", status: "deferred", owner: "FND-06" },
      ],
    }),
  );

  registerProblemDetails(server);

  return server;
}

function responseOutcome(statusCode: number): RequestOutcome {
  if (statusCode >= 500) {
    return "server_error";
  }
  if (statusCode >= 400) {
    return "client_error";
  }

  return "success";
}

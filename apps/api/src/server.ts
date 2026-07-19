import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify, { type FastifyInstance } from "fastify";
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
  readonly checks: ReadonlyArray<{
    readonly name: "auth" | "database" | "object-storage" | "queue";
    readonly status: "deferred";
    readonly owner: string;
  }>;
};

export async function createApiServer(config: ApiConfig): Promise<FastifyInstance> {
  const server = Fastify({
    genReqId: () => crypto.randomUUID(),
    logger: false,
  });

  await server.register(helmet, {
    global: true,
  });
  await server.register(cors, {
    origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
  });

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
    "/ready",
    async (): Promise<ReadinessResponse> => ({
      ready: true,
      service: "api",
      appEnv: config.appEnv,
      checks: [
        { name: "auth", status: "deferred", owner: "OFF-01" },
        { name: "database", status: "deferred", owner: "FND-05" },
        { name: "object-storage", status: "deferred", owner: "FND-06" },
        { name: "queue", status: "deferred", owner: "FND-05" },
      ],
    }),
  );

  registerProblemDetails(server);

  return server;
}

import {
  emergencyCardProjectionSchema,
  emergencyCardPutRequestSchema,
  idempotencyKeySchema,
  uuidV7Schema,
  z,
} from "@littlearc/contracts";
import { SyncPersistenceError } from "@littlearc/database";
import { parseUuidV7 } from "@littlearc/domain";
import type { FastifyInstance } from "fastify";
import type { SyncRouteDependencies } from "./sync-route.js";

const cardParametersSchema = z.object({ cardId: uuidV7Schema });

export function registerEmergencyCardRoutes(
  server: FastifyInstance,
  dependencies: SyncRouteDependencies,
): void {
  server.get("/v1/emergency-cards/:cardId", async (request) => {
    const identityUserId = await requireIdentity(request.headers, dependencies);
    const parameters = cardParametersSchema.safeParse(request.params);
    if (!parameters.success) {
      throw httpError(400, "The emergency-card identifier is invalid.");
    }
    try {
      const card = await dependencies.service.readEmergencyCard({
        cardId: parseUuidV7(parameters.data.cardId, "cardId"),
        identityUserId,
      });
      if (!card) {
        throw httpError(404, "The emergency card was not found.");
      }
      return emergencyCardProjectionSchema.parse(card);
    } catch (error) {
      throw mapPersistenceError(error);
    }
  });

  server.put("/v1/emergency-cards/:cardId", async (request, reply) => {
    const identityUserId = await requireIdentity(request.headers, dependencies);
    const parameters = cardParametersSchema.safeParse(request.params);
    const body = emergencyCardPutRequestSchema.safeParse(request.body);
    const idempotency = idempotencyKeySchema.safeParse(request.headers["idempotency-key"]);
    if (!parameters.success || !body.success || !idempotency.success) {
      throw httpError(400, "The emergency-card request is invalid.");
    }
    try {
      const response = await dependencies.service.push({
        identityUserId,
        mutations: [
          {
            baseRevision: body.data.baseRevision,
            entityId: parseUuidV7(parameters.data.cardId, "cardId"),
            entityType: "emergencyCard",
            idempotencyKey: parseUuidV7(idempotency.data, "Idempotency-Key"),
            localDependencyIds: [],
            mutationId: parseUuidV7(body.data.mutationId, "mutationId"),
            operation: body.data.baseRevision === null ? "create" : "update",
            payload: {
              accessMode: "standard",
              childId: parseUuidV7(body.data.childId, "childId"),
              content: body.data.content,
            },
          },
        ],
      });
      const result = response.results[0];
      if (!result) {
        throw new Error("The emergency-card command returned no result.");
      }
      if (result.status === "applied" || result.status === "duplicate") {
        if (!("cardId" in result.entity)) {
          throw new Error("The emergency-card command returned another entity type.");
        }
        if (result.status === "applied" && body.data.baseRevision === null) {
          reply.status(201);
        }
        return emergencyCardProjectionSchema.parse(result.entity);
      }
      if (result.status === "conflict") {
        throw httpError(409, "The emergency card changed and requires review.");
      }
      if (!("reason" in result)) {
        throw new Error("The emergency-card command returned an invalid outcome.");
      }
      if (result.reason === "authorizationDenied") {
        throw httpError(403, "Emergency-card edit access is not granted.");
      }
      if (result.reason === "validationFailed") {
        throw httpError(400, "The emergency-card content is invalid.");
      }
      throw httpError(409, "The emergency-card command could not be applied.");
    } catch (error) {
      throw mapPersistenceError(error);
    }
  });
}

async function requireIdentity(
  headers: Record<string, string | string[] | undefined>,
  dependencies: SyncRouteDependencies,
): Promise<string> {
  const normalized = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        normalized.append(name, item);
      }
    } else if (value !== undefined) {
      normalized.set(name, value);
    }
  }
  const session = await dependencies.getSessionIdentity(normalized);
  if (!session) {
    throw httpError(401, "An authenticated consumer session is required.");
  }
  return session.userId;
}

function mapPersistenceError(error: unknown): unknown {
  if (error instanceof SyncPersistenceError) {
    if (error.code === "authorization_denied" || error.code === "membership_required") {
      return httpError(403, error.message);
    }
  }
  return error;
}

function httpError(statusCode: number, message: string): Error & { readonly statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

import {
  syncMutationPushRequestSchema,
  syncMutationPushResponseSchema,
  syncPullResponseSchema,
  syncSnapshotPageSchema,
  z,
} from "@littlearc/contracts";
import { SyncPersistenceError } from "@littlearc/database";
import { parseUuidV7 } from "@littlearc/domain";
import type { FastifyInstance } from "fastify";
import type { SyncService } from "./sync.js";

const syncQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type SyncRouteDependencies = {
  readonly getSessionIdentity: (headers: Headers) => Promise<{ readonly userId: string } | null>;
  readonly service: SyncService;
};

export function registerSyncRoutes(
  server: FastifyInstance,
  dependencies: SyncRouteDependencies,
): void {
  server.get("/v1/sync", async (request) => {
    const identityUserId = await requireIdentity(request.headers, dependencies);
    const query = syncQuerySchema.safeParse(request.query);
    if (!query.success) {
      throw httpError(400, "The synchronization page request is invalid.");
    }
    const result = await executeSync(() =>
      dependencies.service.pull({
        ...(query.data.cursor ? { cursor: query.data.cursor } : {}),
        identityUserId,
        limit: query.data.limit,
      }),
    );
    return syncPullResponseSchema.parse(result);
  });

  server.get("/v1/sync/snapshot", async (request) => {
    const identityUserId = await requireIdentity(request.headers, dependencies);
    const query = syncQuerySchema.safeParse(request.query);
    if (!query.success) {
      throw httpError(400, "The synchronization snapshot request is invalid.");
    }
    const result = await executeSync(() =>
      dependencies.service.snapshot({
        ...(query.data.cursor ? { cursor: query.data.cursor } : {}),
        identityUserId,
        limit: query.data.limit,
      }),
    );
    return syncSnapshotPageSchema.parse(result);
  });

  server.post("/v1/sync/mutations", async (request) => {
    const identityUserId = await requireIdentity(request.headers, dependencies);
    const body = syncMutationPushRequestSchema.safeParse(request.body);
    if (!body.success) {
      throw httpError(400, "The synchronization mutation batch is invalid.");
    }
    const result = await executeSync(() =>
      dependencies.service.push({
        identityUserId,
        mutations: body.data.mutations.map((mutation) => ({
          ...mutation,
          entityId: parseUuidV7(mutation.entityId, "entityId"),
          idempotencyKey: parseUuidV7(mutation.idempotencyKey, "idempotencyKey"),
          localDependencyIds: mutation.localDependencyIds.map((id) =>
            parseUuidV7(id, "localDependencyId"),
          ),
          mutationId: parseUuidV7(mutation.mutationId, "mutationId"),
        })),
      }),
    );
    return syncMutationPushResponseSchema.parse(result);
  });
}

async function executeSync<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof SyncPersistenceError) {
      throw httpError(error.code === "membership_required" ? 403 : 400, error.message);
    }
    if (error instanceof Error && /cursor/i.test(error.message)) {
      throw httpError(400, "The synchronization cursor is invalid.");
    }
    throw error;
  }
}

async function requireIdentity(
  headers: Record<string, string | string[] | undefined>,
  dependencies: SyncRouteDependencies,
): Promise<string> {
  const session = await dependencies.getSessionIdentity(toHeaders(headers));
  if (!session) {
    throw httpError(401, "An authenticated consumer session is required.");
  }
  return session.userId;
}

function toHeaders(headers: Record<string, string | string[] | undefined>): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        result.append(name, item);
      }
    } else if (value !== undefined) {
      result.set(name, value);
    }
  }
  return result;
}

function httpError(statusCode: number, message: string): Error & { readonly statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

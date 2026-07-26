import {
  recordProjectionSchema,
  recordVersionPageSchema,
  uuidV7Schema,
  z,
} from "@littlearc/contracts";
import { SyncPersistenceError } from "@littlearc/database";
import { parseUuidV7 } from "@littlearc/domain";
import type { FastifyInstance } from "fastify";
import type { SyncRouteDependencies } from "./sync-route.js";

const recordParametersSchema = z.object({ recordId: uuidV7Schema });
const versionQuerySchema = z.object({
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export function registerRecordRoutes(
  server: FastifyInstance,
  dependencies: SyncRouteDependencies,
): void {
  server.get("/v1/records/:recordId", async (request) => {
    const identityUserId = await requireIdentity(request.headers, dependencies);
    const parameters = recordParametersSchema.safeParse(request.params);
    if (!parameters.success) {
      throw httpError(400, "The record identifier is invalid.");
    }
    try {
      const record = await dependencies.service.readRecord({
        identityUserId,
        recordId: parseUuidV7(parameters.data.recordId, "recordId"),
      });
      if (!record) {
        throw httpError(404, "The record was not found.");
      }
      return recordProjectionSchema.parse(record);
    } catch (error) {
      throw mapPersistenceError(error);
    }
  });

  server.get("/v1/records/:recordId/versions", async (request) => {
    const identityUserId = await requireIdentity(request.headers, dependencies);
    const parameters = recordParametersSchema.safeParse(request.params);
    const query = versionQuerySchema.safeParse(request.query);
    if (!parameters.success || !query.success) {
      throw httpError(400, "The record version request is invalid.");
    }
    try {
      const recordId = parseUuidV7(parameters.data.recordId, "recordId");
      const record = await dependencies.service.readRecord({
        identityUserId,
        recordId,
      });
      if (!record) {
        throw httpError(404, "The record was not found.");
      }
      const beforeVersion = query.data.cursor ? decodeVersionCursor(query.data.cursor) : undefined;
      const items = await dependencies.service.readRecordVersions({
        ...(beforeVersion === undefined ? {} : { beforeVersion }),
        identityUserId,
        limit: query.data.limit + 1,
        recordId,
      });
      const hasMore = items.length > query.data.limit;
      const pageItems = hasMore ? items.slice(0, query.data.limit) : items;
      const nextCursor = hasMore ? encodeVersionCursor(pageItems.at(-1)?.version) : null;
      return recordVersionPageSchema.parse({ items: pageItems, nextCursor });
    } catch (error) {
      throw mapPersistenceError(error);
    }
  });
}

function encodeVersionCursor(version: number | undefined): string {
  if (!version) {
    throw httpError(500, "The record version page could not be continued.");
  }
  return Buffer.from(JSON.stringify({ beforeVersion: version, version: 1 })).toString("base64url");
}

function decodeVersionCursor(cursor: string): number {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      readonly beforeVersion?: unknown;
      readonly version?: unknown;
    };
    if (
      decoded.version !== 1 ||
      typeof decoded.beforeVersion !== "number" ||
      !Number.isInteger(decoded.beforeVersion) ||
      decoded.beforeVersion < 1
    ) {
      throw new Error("invalid cursor");
    }
    return decoded.beforeVersion;
  } catch {
    throw httpError(400, "The record version cursor is invalid.");
  }
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

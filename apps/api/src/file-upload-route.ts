import {
  completeUploadRequestSchema,
  createUploadSessionRequestSchema,
  fileProcessingStatusSchema,
  reconcileUploadPartsRequestSchema,
  uploadSessionSchema,
  uuidV7Schema,
  z,
} from "@littlearc/contracts";
import { FileUploadPersistenceError } from "@littlearc/database";
import { parseUuidV7 } from "@littlearc/domain";
import type { FastifyInstance } from "fastify";
import { type FileUploadService, FileUploadServiceError } from "./file-upload.js";

const sessionParametersSchema = z.object({ sessionId: uuidV7Schema });
const partParametersSchema = z.object({
  partNumber: z.coerce.number().int().min(1).max(10_000),
  sessionId: uuidV7Schema,
});
const downloadParametersSchema = z.object({ fileObjectId: uuidV7Schema });

export type FileUploadRouteDependencies = {
  readonly getSessionIdentity: (headers: Headers) => Promise<{ readonly userId: string } | null>;
  readonly service: FileUploadService;
};

export function registerFileUploadRoutes(
  server: FastifyInstance,
  dependencies: FileUploadRouteDependencies,
): void {
  server.post("/v1/files/uploads", async (request, reply) => {
    const identityUserId = await requireIdentity(request.headers, dependencies);
    const body = createUploadSessionRequestSchema.safeParse(request.body);
    const idempotencyKey = uuidV7Schema.safeParse(request.headers["idempotency-key"]);
    if (!body.success || !idempotencyKey.success) {
      throw httpError(400, "The encrypted upload request is invalid.");
    }
    try {
      const result = await dependencies.service.create({
        identityUserId,
        request: body.data,
        requestId: parseUuidV7(idempotencyKey.data, "idempotencyKey"),
      });
      return reply
        .header("cache-control", "no-store")
        .status(result.replayed ? 200 : 201)
        .send(uploadSessionSchema.parse(result.session));
    } catch (error) {
      throw mapFileError(error);
    }
  });

  server.get("/v1/files/uploads/:sessionId", async (request, reply) => {
    const identityUserId = await requireIdentity(request.headers, dependencies);
    const parameters = sessionParametersSchema.safeParse(request.params);
    if (!parameters.success) {
      throw httpError(400, "The upload session identifier is invalid.");
    }
    try {
      return reply.header("cache-control", "no-store").send(
        uploadSessionSchema.parse(
          await dependencies.service.read({
            identityUserId,
            sessionId: parseUuidV7(parameters.data.sessionId, "sessionId"),
          }),
        ),
      );
    } catch (error) {
      throw mapFileError(error);
    }
  });

  server.post("/v1/files/uploads/:sessionId/parts/:partNumber", async (request, reply) => {
    const identityUserId = await requireIdentity(request.headers, dependencies);
    const parameters = partParametersSchema.safeParse(request.params);
    if (!parameters.success) {
      throw httpError(400, "The multipart request is invalid.");
    }
    try {
      return reply.header("cache-control", "no-store").send(
        await dependencies.service.signPart({
          identityUserId,
          partNumber: parameters.data.partNumber,
          sessionId: parseUuidV7(parameters.data.sessionId, "sessionId"),
        }),
      );
    } catch (error) {
      throw mapFileError(error);
    }
  });

  server.post("/v1/files/uploads/:sessionId/reconcile", async (request, reply) => {
    const identityUserId = await requireIdentity(request.headers, dependencies);
    const parameters = sessionParametersSchema.safeParse(request.params);
    const body = reconcileUploadPartsRequestSchema.safeParse(request.body);
    if (!parameters.success || !body.success) {
      throw httpError(400, "The multipart reconciliation request is invalid.");
    }
    try {
      return reply.header("cache-control", "no-store").send(
        uploadSessionSchema.parse(
          await dependencies.service.reconcile({
            identityUserId,
            sessionId: parseUuidV7(parameters.data.sessionId, "sessionId"),
          }),
        ),
      );
    } catch (error) {
      throw mapFileError(error);
    }
  });

  server.post("/v1/files/uploads/:sessionId/complete", async (request, reply) => {
    const identityUserId = await requireIdentity(request.headers, dependencies);
    const parameters = sessionParametersSchema.safeParse(request.params);
    const body = completeUploadRequestSchema.safeParse(request.body);
    const idempotencyKey = uuidV7Schema.safeParse(request.headers["idempotency-key"]);
    if (!parameters.success || !body.success || !idempotencyKey.success) {
      throw httpError(400, "The multipart completion request is invalid.");
    }
    try {
      return reply.header("cache-control", "no-store").send(
        await dependencies.service.complete({
          identityUserId,
          request: body.data,
          requestId: parseUuidV7(idempotencyKey.data, "idempotencyKey"),
          sessionId: parseUuidV7(parameters.data.sessionId, "sessionId"),
        }),
      );
    } catch (error) {
      throw mapFileError(error);
    }
  });

  server.delete("/v1/files/uploads/:sessionId", async (request, reply) => {
    const identityUserId = await requireIdentity(request.headers, dependencies);
    const parameters = sessionParametersSchema.safeParse(request.params);
    if (!parameters.success) {
      throw httpError(400, "The upload cancellation request is invalid.");
    }
    try {
      await dependencies.service.cancel({
        identityUserId,
        requestId: parseUuidV7(request.id, "requestId"),
        sessionId: parseUuidV7(parameters.data.sessionId, "sessionId"),
      });
      return reply.status(204).send();
    } catch (error) {
      throw mapFileError(error);
    }
  });

  server.get("/v1/files/:fileObjectId/download", async (request, reply) => {
    const identityUserId = await requireIdentity(request.headers, dependencies);
    const parameters = downloadParametersSchema.safeParse(request.params);
    const deviceId = uuidV7Schema.safeParse(request.headers["x-littlearc-device-id"]);
    if (!parameters.success || !deviceId.success) {
      throw httpError(400, "The encrypted download request is invalid.");
    }
    try {
      return reply.header("cache-control", "no-store, private").send(
        await dependencies.service.download({
          deviceId: parseUuidV7(deviceId.data, "deviceId"),
          fileObjectId: parseUuidV7(parameters.data.fileObjectId, "fileObjectId"),
          identityUserId,
          requestId: parseUuidV7(request.id, "requestId"),
        }),
      );
    } catch (error) {
      throw mapFileError(error);
    }
  });

  server.get("/v1/files/:fileObjectId/status", async (request, reply) => {
    const identityUserId = await requireIdentity(request.headers, dependencies);
    const parameters = downloadParametersSchema.safeParse(request.params);
    if (!parameters.success) {
      throw httpError(400, "The file object identifier is invalid.");
    }
    try {
      return reply.header("cache-control", "no-store, private").send(
        fileProcessingStatusSchema.parse(
          await dependencies.service.readStatus({
            fileObjectId: parseUuidV7(parameters.data.fileObjectId, "fileObjectId"),
            identityUserId,
          }),
        ),
      );
    } catch (error) {
      throw mapFileError(error);
    }
  });
}

async function requireIdentity(
  headers: Record<string, string | string[] | undefined>,
  dependencies: FileUploadRouteDependencies,
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

function mapFileError(error: unknown): unknown {
  if (error instanceof FileUploadServiceError) {
    if (error.code === "not_found") {
      return httpError(404, error.message);
    }
    if (error.code === "unavailable") {
      return httpError(503, error.message);
    }
    return httpError(409, error.message);
  }
  if (error instanceof FileUploadPersistenceError) {
    if (error.code === "not_found") {
      return httpError(404, error.message);
    }
    if (error.code === "authorization_denied" || error.code === "device_required") {
      return httpError(403, error.message);
    }
    return httpError(409, error.message);
  }
  return error;
}

function httpError(statusCode: number, message: string): Error & { readonly statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

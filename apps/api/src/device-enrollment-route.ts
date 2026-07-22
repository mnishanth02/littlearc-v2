import { deviceEnrollmentRequestSchema } from "@littlearc/contracts";
import { DeviceEnrollmentPersistenceError } from "@littlearc/database";
import type { UuidV7 } from "@littlearc/domain";
import { parseUuidV7 } from "@littlearc/domain";
import type { FastifyInstance } from "fastify";

export type DeviceEnrollmentCommand = {
  readonly execute: (input: {
    readonly identityUserId: string;
    readonly request: {
      readonly appVersion: string;
      readonly deviceId: UuidV7;
      readonly localSchemaVersion: 1 | 2;
      readonly platform: "android" | "ios";
    };
    readonly requestId: UuidV7;
  }) => Promise<{
    readonly deviceId: UuidV7;
    readonly enrollmentStatus: "active";
    readonly householdId: UuidV7;
    readonly localSchemaVersion: 1 | 2;
    readonly replayed: boolean;
  }>;
};

export type DeviceEnrollmentRouteDependencies = {
  readonly command: DeviceEnrollmentCommand;
  readonly getSessionIdentity: (headers: Headers) => Promise<{ readonly userId: string } | null>;
};

export function registerDeviceEnrollmentRoute(
  server: FastifyInstance,
  dependencies: DeviceEnrollmentRouteDependencies,
): void {
  server.post("/v1/devices/enrollment", async (request, reply) => {
    const session = await dependencies.getSessionIdentity(toHeaders(request.headers));
    if (!session) {
      throw httpError(401, "An authenticated consumer session is required.");
    }
    const body = deviceEnrollmentRequestSchema.safeParse(request.body);
    if (!body.success) {
      throw httpError(400, "The device enrollment request is invalid.");
    }

    try {
      const result = await dependencies.command.execute({
        identityUserId: session.userId,
        request: {
          ...body.data,
          deviceId: parseUuidV7(body.data.deviceId, "deviceId"),
        },
        requestId: parseUuidV7(request.id, "requestId"),
      });
      return reply.status(result.replayed ? 200 : 201).send(result);
    } catch (error) {
      if (error instanceof DeviceEnrollmentPersistenceError) {
        throw httpError(error.code === "membership_required" ? 403 : 409, error.message);
      }
      throw error;
    }
  });
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

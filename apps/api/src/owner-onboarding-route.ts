import { idempotencyKeySchema, ownerOnboardingRequestSchema } from "@littlearc/contracts";
import { OwnerOnboardingPersistenceError } from "@littlearc/database";
import { OwnerOnboardingPolicyError, parseUuidV7 } from "@littlearc/domain";
import type { FastifyInstance } from "fastify";
import type { OwnerOnboardingCommand } from "./owner-onboarding.js";

export type OwnerOnboardingRouteDependencies = {
  readonly command: OwnerOnboardingCommand;
  readonly getSessionIdentity: (headers: Headers) => Promise<{ readonly userId: string } | null>;
};

export function registerOwnerOnboardingRoute(
  server: FastifyInstance,
  dependencies: OwnerOnboardingRouteDependencies,
): void {
  server.post("/v1/households/onboarding", async (request, reply) => {
    const session = await dependencies.getSessionIdentity(toHeaders(request.headers));
    if (!session) {
      throw httpError(401, "An authenticated consumer session is required.");
    }
    const idempotency = idempotencyKeySchema.safeParse(request.headers["idempotency-key"]);
    const body = ownerOnboardingRequestSchema.safeParse(request.body);
    if (!idempotency.success || !body.success) {
      throw httpError(400, "The onboarding request is invalid.");
    }

    try {
      const result = await dependencies.command.execute({
        idempotencyKey: parseUuidV7(idempotency.data, "Idempotency-Key"),
        identityUserId: session.userId,
        request: body.data,
        requestId: parseUuidV7(request.id, "requestId"),
      });
      return reply.status(result.replayed ? 200 : 201).send(result);
    } catch (error) {
      if (error instanceof OwnerOnboardingPersistenceError) {
        throw httpError(409, error.message);
      }
      if (error instanceof OwnerOnboardingPolicyError) {
        throw httpError(error.code === "adult_verification_required" ? 403 : 400, error.message);
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

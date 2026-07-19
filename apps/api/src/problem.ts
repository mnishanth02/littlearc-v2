import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export type ProblemDetails = {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance: string;
  readonly requestId: string;
};

export function registerProblemDetails(server: FastifyInstance): void {
  server.setNotFoundHandler((request, reply) => {
    sendProblem(reply, request, {
      type: "https://littlearc.app/problems/not-found",
      title: "Not Found",
      status: 404,
      detail: "The requested resource does not exist.",
    });
  });

  server.setErrorHandler((error, request, reply) => {
    const status = normalizeStatus(error);
    const message = error instanceof Error ? error.message : "The request could not be completed.";

    sendProblem(reply, request, {
      type: "https://littlearc.app/problems/internal-error",
      title: status >= 500 ? "Internal Server Error" : "Request Error",
      status,
      detail: status >= 500 ? "The request could not be completed." : message,
    });
  });
}

function sendProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  problem: Omit<ProblemDetails, "instance" | "requestId">,
): void {
  const body: ProblemDetails = {
    ...problem,
    instance: request.url,
    requestId: request.id,
  };

  reply.type("application/problem+json").status(problem.status).send(body);
}

function normalizeStatus(error: unknown): number {
  if (typeof error === "object" && error && "statusCode" in error) {
    const { statusCode } = error as { readonly statusCode?: unknown };

    if (typeof statusCode === "number" && statusCode >= 400 && statusCode <= 599) {
      return statusCode;
    }
  }

  return 500;
}

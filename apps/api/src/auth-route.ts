import type { ConsumerAuth } from "@littlearc/auth";
import type { FastifyInstance, FastifyRequest } from "fastify";

type AuthHandler = Pick<ConsumerAuth, "handler">;

export function registerConsumerAuthRoute(
  server: FastifyInstance,
  auth: AuthHandler,
  baseUrl: string,
): void {
  server.route({
    method: ["GET", "POST"],
    url: "/v1/auth/*",
    async handler(request, reply) {
      const authRequest = toFetchRequest(request, baseUrl);
      const response = await auth.handler(authRequest);

      reply.code(response.status);

      const setCookies = response.headers.getSetCookie();
      response.headers.forEach((value, name) => {
        if (name !== "set-cookie") {
          reply.header(name, value);
        }
      });
      if (setCookies.length > 0) {
        reply.header("set-cookie", setCookies);
      }

      return reply.send(response.body ? await response.text() : null);
    },
  });
}

function toFetchRequest(request: FastifyRequest, baseUrl: string): Request {
  const method = request.method.toUpperCase();
  const headers = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    } else if (value !== undefined) {
      headers.set(name, String(value));
    }
  }

  return new Request(new URL(request.url, baseUrl), {
    ...(method === "GET" || method === "HEAD" || request.body === undefined
      ? {}
      : { body: JSON.stringify(request.body) }),
    headers,
    method,
  });
}

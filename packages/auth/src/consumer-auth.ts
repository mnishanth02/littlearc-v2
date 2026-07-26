import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import {
  auth_account,
  auth_rate_limit,
  auth_session,
  auth_user,
  auth_verification,
  type DatabaseClient,
} from "@littlearc/database";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import type { OtpDelivery } from "./otp-delivery.js";
import { recentAuthenticationWindowSeconds } from "./recent-authentication.js";

const sessionLifetimeSeconds = 60 * 60 * 24 * 7;
const sessionRotationSeconds = 60 * 60 * 24;

export type SocialProviderCredentials = {
  readonly clientId: string;
  readonly clientSecret: string;
};

export type ConsumerAuthOptions = {
  readonly apple?: SocialProviderCredentials;
  readonly baseUrl: string;
  readonly database?: DatabaseClient;
  readonly google?: SocialProviderCredentials;
  readonly otpDelivery: OtpDelivery;
  readonly production?: boolean;
  readonly secret: string;
  readonly trustedOrigins: ReadonlyArray<string>;
};

export type ConsumerAuth = {
  readonly handler: (request: Request) => Promise<Response>;
  readonly getSessionIdentity: (headers: Headers) => Promise<ConsumerSessionIdentity | null>;
};

export type ConsumerSessionIdentity = {
  readonly authenticatedAt: Date;
  readonly userId: string;
};

export function createConsumerAuth(options: ConsumerAuthOptions): ConsumerAuth {
  validateConsumerAuthOptions(options);

  const auth = betterAuth({
    account: {
      accountLinking: {
        enabled: false,
        trustedProviders: [],
      },
      ...(options.database ? { modelName: "auth_account" } : {}),
    },
    basePath: "/v1/auth",
    baseURL: options.baseUrl,
    database: options.database
      ? drizzleAdapter(options.database, {
          provider: "pg",
          schema: {
            auth_account,
            auth_rate_limit,
            auth_session,
            auth_user,
            auth_verification,
          },
        })
      : undefined,
    emailAndPassword: {
      enabled: false,
    },
    plugins: [
      expo(),
      emailOTP({
        allowedAttempts: 3,
        expiresIn: 300,
        otpLength: 6,
        rateLimit: {
          max: 3,
          window: 60,
        },
        resendStrategy: "rotate",
        sendVerificationOTP: ({ email, otp, type }) =>
          options.otpDelivery.send({ email, otp, purpose: type }),
        storeOTP: "hashed",
      }),
    ],
    rateLimit: {
      enabled: true,
      ...(options.database ? { modelName: "auth_rate_limit" } : {}),
      storage: options.database ? "database" : "memory",
    },
    secret: options.secret,
    session: {
      expiresIn: sessionLifetimeSeconds,
      freshAge: recentAuthenticationWindowSeconds,
      ...(options.database ? { modelName: "auth_session" } : {}),
      updateAge: sessionRotationSeconds,
    },
    socialProviders: {
      ...(options.apple ? { apple: options.apple } : {}),
      ...(options.google ? { google: options.google } : {}),
    },
    trustedOrigins: [...options.trustedOrigins],
    user: {
      ...(options.database ? { modelName: "auth_user" } : {}),
    },
    verification: {
      ...(options.database ? { modelName: "auth_verification" } : {}),
    },
  });

  const trustedOrigins = new Set(options.trustedOrigins.map(normalizeOrigin));

  return {
    async getSessionIdentity(headers) {
      const result = await auth.api.getSession({ headers });
      if (!result) {
        return null;
      }
      return {
        authenticatedAt: result.session.createdAt,
        userId: result.user.id,
      };
    },
    async handler(request) {
      const origin = request.headers.get("origin");
      if (origin && !trustedOrigins.has(normalizeOrigin(origin))) {
        return Response.json({ message: "Forbidden origin." }, { status: 403 });
      }

      return auth.handler(request);
    },
  };
}

function normalizeOrigin(origin: string): string {
  let end = origin.length;
  while (end > 0 && origin.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return origin.slice(0, end).toLowerCase();
}

function validateConsumerAuthOptions(options: ConsumerAuthOptions): void {
  if (options.secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  }
  if (options.trustedOrigins.length === 0) {
    throw new Error("At least one explicit auth trusted origin is required.");
  }
  if (options.production && !options.database) {
    throw new Error("Production consumer auth requires PostgreSQL-backed state.");
  }
  if (options.production && !options.baseUrl.startsWith("https://")) {
    throw new Error("Production consumer auth requires an HTTPS base URL.");
  }

  for (const origin of options.trustedOrigins) {
    if (origin.includes("*")) {
      throw new Error("Auth trusted origins must not contain wildcards.");
    }
    if (options.production && origin.startsWith("http://")) {
      throw new Error("Production auth web origins must use HTTPS.");
    }
  }
}

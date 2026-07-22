import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";

// The CLI reads this configuration only to derive the exact pinned schema.
// Runtime construction lives in src/consumer-auth.ts and receives a real
// database plus delivery adapter from the API composition root.
export const auth = betterAuth({
  account: {
    accountLinking: {
      enabled: false,
      trustedProviders: [],
    },
    modelName: "auth_account",
  },
  basePath: "/v1/auth",
  baseURL: "http://127.0.0.1:3000",
  database: drizzleAdapter({} as never, {
    provider: "pg",
  }),
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
      async sendVerificationOTP() {},
      storeOTP: "hashed",
    }),
  ],
  rateLimit: {
    enabled: true,
    modelName: "auth_rate_limit",
    storage: "database",
  },
  secret: "littlearc-off-01-schema-generation-only-secret",
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    freshAge: 60 * 10,
    modelName: "auth_session",
    updateAge: 60 * 60 * 24,
  },
  trustedOrigins: ["littlearc://", "http://127.0.0.1:3000"],
  user: {
    modelName: "auth_user",
  },
  verification: {
    modelName: "auth_verification",
  },
});

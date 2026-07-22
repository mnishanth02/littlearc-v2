import { createConsumerAuth, createResendOtpDelivery } from "@littlearc/auth";
import { createDatabaseConnection } from "@littlearc/database";
import { createSafeLogger } from "@littlearc/observability";
import { loadApiConfig } from "./config.js";
import { createApiServer } from "./server.js";

const config = loadApiConfig();
const logger = createSafeLogger({
  environment: config.appEnv,
  service: "api",
  sink(record) {
    console.log(JSON.stringify(record));
  },
  version: "0.0.0",
});
const databaseConnection = config.consumerAuth
  ? createDatabaseConnection(config.consumerAuth.databaseUrl)
  : undefined;
const consumerAuth =
  config.consumerAuth && databaseConnection
    ? createConsumerAuth({
        ...(config.consumerAuth.apple ? { apple: config.consumerAuth.apple } : {}),
        baseUrl: config.consumerAuth.baseUrl,
        database: databaseConnection.database,
        ...(config.consumerAuth.google ? { google: config.consumerAuth.google } : {}),
        otpDelivery: createResendOtpDelivery({
          apiKey: config.consumerAuth.resendApiKey,
          from: config.consumerAuth.emailFrom,
        }),
        production: config.appEnv === "production",
        secret: config.consumerAuth.secret,
        trustedOrigins: config.consumerAuth.trustedOrigins,
      })
    : undefined;
const server = await createApiServer(config, logger, consumerAuth);

if (databaseConnection) {
  server.addHook("onClose", () => databaseConnection.close());
}

await server.listen({
  host: config.host,
  port: config.port,
});

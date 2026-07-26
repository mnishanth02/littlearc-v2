import { createConsumerAuth, createResendOtpDelivery } from "@littlearc/auth";
import { createFileKeyCrypto, createStructuredPayloadCrypto } from "@littlearc/crypto";
import {
  createDatabaseConnection,
  createFilePreviewGrantPersistence,
  createFileUploadPersistence,
  createSyncCursorCodec,
  createSyncPersistence,
} from "@littlearc/database";
import { createSafeLogger } from "@littlearc/observability";
import { createS3EncryptedObjectStorage } from "@littlearc/storage";
import { loadApiConfig } from "./config.js";
import { createDeviceEnrollmentCommand } from "./device-enrollment.js";
import { createFileUploadService } from "./file-upload.js";
import {
  createOwnerOnboardingCommand,
  createSyntheticAdultVerification,
} from "./owner-onboarding.js";
import { createApiServer } from "./server.js";
import { createSyncService } from "./sync.js";

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
const structuredPayloadCrypto = config.keyWrapping
  ? createStructuredPayloadCrypto({
      keyEncryptionKey: Buffer.from(config.keyWrapping.keyEncryptionKey, "base64url"),
      wrappingKeyVersion: config.keyWrapping.wrappingKeyVersion,
    })
  : undefined;
const ownerOnboarding =
  config.ownerOnboarding && consumerAuth && databaseConnection && structuredPayloadCrypto
    ? {
        command: createOwnerOnboardingCommand({
          adultVerification: createSyntheticAdultVerification(),
          crypto: structuredPayloadCrypto,
          database: databaseConnection.database,
        }),
        getSessionIdentity: consumerAuth.getSessionIdentity,
      }
    : undefined;
const deviceEnrollment =
  consumerAuth && databaseConnection
    ? {
        command: createDeviceEnrollmentCommand(databaseConnection.database),
        getSessionIdentity: consumerAuth.getSessionIdentity,
      }
    : undefined;
const sync =
  consumerAuth && databaseConnection && structuredPayloadCrypto && config.keyWrapping
    ? {
        getSessionIdentity: consumerAuth.getSessionIdentity,
        service: createSyncService({
          cursorCodec: createSyncCursorCodec(
            Buffer.from(config.keyWrapping.keyEncryptionKey, "base64url"),
          ),
          persistence: createSyncPersistence({
            crypto: structuredPayloadCrypto,
            database: databaseConnection.database,
          }),
        }),
      }
    : undefined;
const fileStorage = config.uploadStorage
  ? createS3EncryptedObjectStorage({
      accessKeyId: config.uploadStorage.accessKeyId,
      bucket: config.uploadStorage.bucket,
      endpoint: config.uploadStorage.endpoint,
      region: config.uploadStorage.region,
      secretAccessKey: config.uploadStorage.secretAccessKey,
    })
  : undefined;
const files =
  consumerAuth && databaseConnection && structuredPayloadCrypto && fileStorage
    ? {
        getSessionIdentity: consumerAuth.getSessionIdentity,
        service: createFileUploadService({
          enabled: config.uploadsEnabled,
          persistence: createFileUploadPersistence({
            crypto: structuredPayloadCrypto,
            database: databaseConnection.database,
            fileKeyCrypto: createFileKeyCrypto({ currentKeyVersion: 1 }),
          }),
          previewPersistence: createFilePreviewGrantPersistence({
            crypto: structuredPayloadCrypto,
            database: databaseConnection.database,
            fileKeyCrypto: createFileKeyCrypto({ currentKeyVersion: 1 }),
          }),
          storage: fileStorage,
        }),
      }
    : undefined;
const server = await createApiServer(
  config,
  logger,
  consumerAuth,
  ownerOnboarding,
  deviceEnrollment,
  sync,
  files,
);

if (databaseConnection) {
  server.addHook("onClose", () => databaseConnection.close());
}

await server.listen({
  host: config.host,
  port: config.port,
});

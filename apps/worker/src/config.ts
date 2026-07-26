import { tmpdir } from "node:os";
import { join } from "node:path";

export type AppEnvironment = "local" | "staging" | "production";

export type WorkerConfig = {
  readonly appEnv: AppEnvironment;
  readonly databaseUrl?: string;
  readonly heartbeatIntervalMs: number;
  readonly queueConnectionMode: "deferred" | "configured";
  readonly stagingProbeEnabled: boolean;
  readonly uploadCleanupIntervalMs: number;
  readonly uploadStorage?: UploadStorageConfig;
  readonly fileValidation: FileValidationConfig;
};

export type FileValidationConfig =
  | { readonly enabled: false; readonly previewsEnabled: false }
  | {
      readonly clamdHost: string;
      readonly clamdPort: number;
      readonly concurrency: number;
      readonly enabled: true;
      readonly keyEncryptionKey: Buffer;
      readonly previewsEnabled: false;
      readonly qpdfExecutable: string;
      readonly sandboxExecutable?: string;
      readonly signatureMinimumVersion: number;
      readonly signatureMaxAgeHours: number;
      readonly signatureObservedAt: Date;
      readonly tmpDir: string;
    };

export type UploadStorageConfig = {
  readonly accessKeyId: string;
  readonly bucket: string;
  readonly endpoint: string;
  readonly region: string;
  readonly secretAccessKey: string;
};

type WorkerEnvironment = Partial<NodeJS.ProcessEnv>;

const allowedEnvironments = new Set<AppEnvironment>(["local", "staging", "production"]);

export function loadWorkerConfig(environment: WorkerEnvironment = process.env): WorkerConfig {
  const configuredDatabaseUrl = environment.DATABASE_URL?.trim();
  const databaseUrl = configuredDatabaseUrl
    ? constrainWorkerDatabaseUrl(configuredDatabaseUrl)
    : undefined;
  const uploadStorage = parseUploadStorage(environment);
  const appEnv = parseAppEnvironment(environment.APP_ENV);
  const stagingProbeEnabled = parseBoolean(
    "FILE_VALIDATION_STAGING_PROBE",
    environment.FILE_VALIDATION_STAGING_PROBE,
  );
  if (stagingProbeEnabled && appEnv !== "staging") {
    throw new Error("FILE_VALIDATION_STAGING_PROBE is authorized only in staging.");
  }
  return {
    appEnv,
    ...(databaseUrl ? { databaseUrl } : {}),
    heartbeatIntervalMs: 30_000,
    queueConnectionMode: databaseUrl ? "configured" : "deferred",
    stagingProbeEnabled,
    uploadCleanupIntervalMs: 60_000,
    ...(uploadStorage ? { uploadStorage } : {}),
    fileValidation: parseFileValidation(environment, appEnv, databaseUrl, uploadStorage),
  };
}

export function constrainWorkerDatabaseUrl(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  const existingOptions = parsed.searchParams.get("options")?.trim();
  parsed.searchParams.set(
    "options",
    [existingOptions, "-c role=littlearc_worker"].filter(Boolean).join(" "),
  );
  return parsed.toString();
}

function parseFileValidation(
  environment: WorkerEnvironment,
  appEnv: AppEnvironment,
  databaseUrl: string | undefined,
  uploadStorage: UploadStorageConfig | undefined,
): FileValidationConfig {
  const enabled = parseBoolean("FILE_VALIDATION_ENABLED", environment.FILE_VALIDATION_ENABLED);
  const previewsEnabled = parseBoolean("FILE_PREVIEWS_ENABLED", environment.FILE_PREVIEWS_ENABLED);
  if (previewsEnabled) {
    throw new Error("FILE_PREVIEWS_ENABLED is not authorized for VLT-05.");
  }
  if (!enabled) {
    return { enabled: false, previewsEnabled: false };
  }
  if (appEnv === "production") {
    throw new Error("Worker file validation is not authorized in production.");
  }
  if (!databaseUrl || !uploadStorage) {
    throw new Error("File validation requires database and object storage configuration.");
  }
  const key = Buffer.from(
    required("KEY_WRAPPING_SECRET_V1", environment.KEY_WRAPPING_SECRET_V1),
    "base64url",
  );
  if (key.length !== 32) {
    throw new Error("KEY_WRAPPING_SECRET_V1 must decode to exactly 32 bytes.");
  }
  const concurrency = parseInteger(
    "FILE_VALIDATION_CONCURRENCY",
    environment.FILE_VALIDATION_CONCURRENCY,
    1,
    1,
  );
  return {
    clamdHost: required("CLAMD_HOST", environment.CLAMD_HOST),
    clamdPort: parseInteger("CLAMD_PORT", environment.CLAMD_PORT, 3310, 65_535),
    concurrency,
    enabled: true,
    keyEncryptionKey: key,
    previewsEnabled: false,
    qpdfExecutable: environment.QPDF_EXECUTABLE?.trim() || "/usr/bin/qpdf",
    ...(environment.FILE_VALIDATION_SANDBOX_EXECUTABLE?.trim()
      ? { sandboxExecutable: environment.FILE_VALIDATION_SANDBOX_EXECUTABLE.trim() }
      : {}),
    signatureMinimumVersion: parseInteger(
      "CLAMD_SIGNATURE_MIN_VERSION",
      environment.CLAMD_SIGNATURE_MIN_VERSION,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    signatureMaxAgeHours: parseInteger(
      "CLAMD_SIGNATURE_MAX_AGE_HOURS",
      environment.CLAMD_SIGNATURE_MAX_AGE_HOURS,
      24,
      168,
    ),
    signatureObservedAt: parseTimestamp(
      "CLAMD_SIGNATURE_OBSERVED_AT",
      environment.CLAMD_SIGNATURE_OBSERVED_AT,
    ),
    tmpDir:
      environment.FILE_VALIDATION_TMP_DIR?.trim() || join(tmpdir(), "littlearc-file-validation"),
  };
}

function parseTimestamp(name: string, value: string | undefined): Date {
  const normalized = required(name, value);
  const milliseconds = Date.parse(normalized);
  if (!Number.isFinite(milliseconds)) {
    throw new Error(`${name} must be an ISO 8601 timestamp.`);
  }
  return new Date(milliseconds);
}

function parseUploadStorage(environment: WorkerEnvironment): UploadStorageConfig | undefined {
  const values = [
    environment.S3_ENDPOINT,
    environment.S3_ACCESS_KEY_ID,
    environment.S3_SECRET_ACCESS_KEY,
    environment.S3_BUCKET_NAME,
  ];
  if (values.every((value) => !value?.trim())) {
    return undefined;
  }
  return {
    accessKeyId: required("S3_ACCESS_KEY_ID", environment.S3_ACCESS_KEY_ID),
    bucket: required("S3_BUCKET_NAME", environment.S3_BUCKET_NAME),
    endpoint: required("S3_ENDPOINT", environment.S3_ENDPOINT),
    region: environment.S3_REGION?.trim() || "auto",
    secretAccessKey: required("S3_SECRET_ACCESS_KEY", environment.S3_SECRET_ACCESS_KEY),
  };
}

function required(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${name} is required when worker object storage is configured.`);
  }
  return normalized;
}

function parseAppEnvironment(value: string | undefined): AppEnvironment {
  if (!value) {
    return "local";
  }

  if (allowedEnvironments.has(value as AppEnvironment)) {
    return value as AppEnvironment;
  }

  throw new Error(`APP_ENV must be one of local, staging, or production; received ${value}`);
}

function parseBoolean(name: string, value: string | undefined): boolean {
  const normalized = value?.trim() || "false";
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  throw new Error(`${name} must be true or false.`);
}

function parseInteger(
  name: string,
  value: string | undefined,
  fallback: number,
  maximum: number,
): number {
  const parsed = value ? Number(value) : fallback;
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
  }
  return parsed;
}

export type AppEnvironment = "local" | "staging" | "production";

export type WorkerConfig = {
  readonly appEnv: AppEnvironment;
  readonly databaseUrl?: string;
  readonly heartbeatIntervalMs: number;
  readonly queueConnectionMode: "deferred" | "configured";
  readonly uploadCleanupIntervalMs: number;
  readonly uploadStorage?: UploadStorageConfig;
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
  const databaseUrl = environment.DATABASE_URL?.trim();
  const uploadStorage = parseUploadStorage(environment);
  return {
    appEnv: parseAppEnvironment(environment.APP_ENV),
    ...(databaseUrl ? { databaseUrl } : {}),
    heartbeatIntervalMs: 30_000,
    queueConnectionMode: databaseUrl ? "configured" : "deferred",
    uploadCleanupIntervalMs: 60_000,
    ...(uploadStorage ? { uploadStorage } : {}),
  };
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

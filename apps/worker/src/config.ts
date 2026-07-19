export type AppEnvironment = "local" | "staging" | "production";

export type WorkerConfig = {
  readonly appEnv: AppEnvironment;
  readonly heartbeatIntervalMs: number;
  readonly queueConnectionMode: "deferred" | "configured";
};

type WorkerEnvironment = Partial<NodeJS.ProcessEnv>;

const allowedEnvironments = new Set<AppEnvironment>(["local", "staging", "production"]);

export function loadWorkerConfig(environment: WorkerEnvironment = process.env): WorkerConfig {
  return {
    appEnv: parseAppEnvironment(environment.APP_ENV),
    heartbeatIntervalMs: 30_000,
    queueConnectionMode: environment.DATABASE_URL ? "configured" : "deferred",
  };
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

export type AppEnvironment = "local" | "staging" | "production";

export type ApiConfig = {
  readonly appEnv: AppEnvironment;
  readonly host: string;
  readonly port: number;
};

type ApiEnvironment = Partial<NodeJS.ProcessEnv>;

const allowedEnvironments = new Set<AppEnvironment>(["local", "staging", "production"]);

export function loadApiConfig(environment: ApiEnvironment = process.env): ApiConfig {
  const appEnv = parseAppEnvironment(environment.APP_ENV);

  return {
    appEnv,
    host: environment.HOST?.trim() || "127.0.0.1",
    port: parsePort(environment.PORT),
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

function parsePort(value: string | undefined): number {
  if (!value) {
    return 3000;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`PORT must be an integer from 1 to 65535; received ${value}`);
  }

  return port;
}

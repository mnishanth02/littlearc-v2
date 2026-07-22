export type AppEnvironment = "local" | "staging" | "production";

export type ApiConfig = {
  readonly appEnv: AppEnvironment;
  readonly consumerAuth?: ConsumerAuthConfig;
  readonly host: string;
  readonly port: number;
};

export type ConsumerAuthConfig = {
  readonly apple?: ProviderCredentials;
  readonly baseUrl: string;
  readonly databaseUrl: string;
  readonly emailFrom: string;
  readonly google?: ProviderCredentials;
  readonly resendApiKey: string;
  readonly secret: string;
  readonly trustedOrigins: ReadonlyArray<string>;
};

type ProviderCredentials = {
  readonly clientId: string;
  readonly clientSecret: string;
};

type ApiEnvironment = Partial<NodeJS.ProcessEnv>;

const allowedEnvironments = new Set<AppEnvironment>(["local", "staging", "production"]);

export function loadApiConfig(environment: ApiEnvironment = process.env): ApiConfig {
  const appEnv = parseAppEnvironment(environment.APP_ENV);

  const consumerAuth = parseConsumerAuthConfig(environment);

  return {
    appEnv,
    ...(consumerAuth ? { consumerAuth } : {}),
    host: environment.HOST?.trim() || "127.0.0.1",
    port: parsePort(environment.PORT),
  };
}

function parseConsumerAuthConfig(environment: ApiEnvironment): ConsumerAuthConfig | undefined {
  const authValues = [
    environment.AUTH_BASE_URL,
    environment.AUTH_EMAIL_FROM,
    environment.AUTH_TRUSTED_ORIGINS,
    environment.BETTER_AUTH_SECRET,
    environment.RESEND_API_KEY,
    environment.APPLE_CLIENT_ID,
    environment.APPLE_CLIENT_SECRET,
    environment.GOOGLE_CLIENT_ID,
    environment.GOOGLE_CLIENT_SECRET,
  ];
  if (authValues.every((value) => !value?.trim())) {
    return undefined;
  }

  const baseUrl = requiredValue("AUTH_BASE_URL", environment.AUTH_BASE_URL);
  const trustedOrigins = requiredValue("AUTH_TRUSTED_ORIGINS", environment.AUTH_TRUSTED_ORIGINS)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (trustedOrigins.length === 0) {
    throw new Error("AUTH_TRUSTED_ORIGINS must contain at least one explicit origin.");
  }

  const apple = parseProviderCredentials(
    "APPLE",
    environment.APPLE_CLIENT_ID,
    environment.APPLE_CLIENT_SECRET,
  );
  const google = parseProviderCredentials(
    "GOOGLE",
    environment.GOOGLE_CLIENT_ID,
    environment.GOOGLE_CLIENT_SECRET,
  );

  return {
    ...(apple ? { apple } : {}),
    baseUrl,
    databaseUrl: requiredValue("DATABASE_URL", environment.DATABASE_URL),
    emailFrom: requiredValue("AUTH_EMAIL_FROM", environment.AUTH_EMAIL_FROM),
    ...(google ? { google } : {}),
    resendApiKey: requiredValue("RESEND_API_KEY", environment.RESEND_API_KEY),
    secret: requiredValue("BETTER_AUTH_SECRET", environment.BETTER_AUTH_SECRET),
    trustedOrigins,
  };
}

function parseProviderCredentials(
  provider: "APPLE" | "GOOGLE",
  clientId: string | undefined,
  clientSecret: string | undefined,
): ProviderCredentials | undefined {
  if (!clientId?.trim() && !clientSecret?.trim()) {
    return undefined;
  }
  if (!clientId?.trim() || !clientSecret?.trim()) {
    throw new Error(
      `${provider}_CLIENT_ID and ${provider}_CLIENT_SECRET must be configured together.`,
    );
  }

  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
  };
}

function requiredValue(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${name} is required when consumer auth is configured.`);
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

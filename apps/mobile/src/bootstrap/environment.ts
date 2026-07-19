import Constants from "expo-constants";

export type AppEnvironment = "local" | "staging" | "production";

export type MobileEnvironment = {
  readonly appEnv: AppEnvironment;
  readonly apiBaseUrl: string;
};

type ExpoExtra = {
  readonly appEnv?: string;
  readonly apiBaseUrl?: string;
};

export function getMobileEnvironment(): MobileEnvironment {
  const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;

  return {
    appEnv: parseAppEnvironment(extra.appEnv),
    apiBaseUrl: extra.apiBaseUrl || "http://127.0.0.1:3000",
  };
}

function parseAppEnvironment(value: string | undefined): AppEnvironment {
  if (value === "staging" || value === "production") {
    return value;
  }

  return "local";
}

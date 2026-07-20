import { assertNoSensitiveCanary, type SensitiveCanary } from "./canary.js";
import type { RuntimeEnvironment, ServiceName } from "./types.js";

export const analyticsEventNames = ["application_started", "foundation_health_checked"] as const;
export type AnalyticsEventName = (typeof analyticsEventNames)[number];

export type AnalyticsEventMap = {
  readonly application_started: {
    readonly appVersion: string;
    readonly environment: RuntimeEnvironment;
    readonly platform: "android" | "ios" | "server" | "web";
  };
  readonly foundation_health_checked: {
    readonly duration: "under_100ms" | "under_500ms" | "under_2s" | "over_2s";
    readonly outcome: "failure" | "success";
    readonly service: ServiceName;
  };
};

export type SafeAnalyticsEvent<Name extends AnalyticsEventName = AnalyticsEventName> = {
  readonly name: Name;
  readonly properties: AnalyticsEventMap[Name];
};

export type AnalyticsSink = (event: SafeAnalyticsEvent) => void;

export type Analytics = {
  readonly capture: <Name extends AnalyticsEventName>(
    name: Name,
    properties: AnalyticsEventMap[Name],
  ) => boolean;
};

export type AnalyticsOptions = {
  readonly enabled?: boolean;
  readonly sink?: AnalyticsSink;
  readonly canaries?: ReadonlyArray<SensitiveCanary>;
};

const safeVersion = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/;

export function createAnalytics(options: AnalyticsOptions = {}): Analytics {
  return {
    capture(name, properties) {
      if (!options.enabled || !options.sink) {
        return false;
      }

      const event = sanitizeAnalyticsEvent(name, properties);
      assertNoSensitiveCanary(event, options.canaries ?? []);
      options.sink(event);
      return true;
    },
  };
}

export function sanitizeAnalyticsEvent(name: string, properties: unknown): SafeAnalyticsEvent {
  if (name === "application_started") {
    const value = requireExactObject(properties, ["appVersion", "environment", "platform"]);
    const appVersion = requireString(value.appVersion, "appVersion");
    const environment = requireEnum(value.environment, ["local", "staging", "production"]);
    const platform = requireEnum(value.platform, ["android", "ios", "server", "web"]);

    if (!safeVersion.test(appVersion)) {
      throw new Error("Analytics appVersion must be a stable identifier");
    }

    return { name, properties: { appVersion, environment, platform } };
  }

  if (name === "foundation_health_checked") {
    const value = requireExactObject(properties, ["duration", "outcome", "service"]);
    const duration = requireEnum(value.duration, [
      "under_100ms",
      "under_500ms",
      "under_2s",
      "over_2s",
    ]);
    const outcome = requireEnum(value.outcome, ["failure", "success"]);
    const service = requireEnum(value.service, ["api", "worker", "mobile", "ops-web"]);

    return { name, properties: { duration, outcome, service } };
  }

  throw new Error(`Analytics event is not allowlisted: ${name}`);
}

function requireExactObject(
  value: unknown,
  allowedKeys: ReadonlyArray<string>,
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Analytics properties must be an object");
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const extraKey = keys.find((key) => !allowedKeys.includes(key));
  const missingKey = allowedKeys.find((key) => !Object.hasOwn(record, key));

  if (extraKey || missingKey) {
    throw new Error("Analytics properties do not match the event allowlist");
  }

  return record;
}

function requireEnum<const Value extends string>(
  value: unknown,
  allowed: ReadonlyArray<Value>,
): Value {
  if (typeof value !== "string" || !allowed.includes(value as Value)) {
    throw new Error("Analytics property is outside its bounded value set");
  }

  return value as Value;
}

function requireString(value: unknown, key: string): string {
  if (typeof value !== "string") {
    throw new Error(`Analytics ${key} must be a string`);
  }

  return value;
}

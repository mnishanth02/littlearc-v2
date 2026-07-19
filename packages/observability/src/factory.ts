import { type Analytics, createAnalytics } from "./analytics.js";
import type { SensitiveCanary } from "./canary.js";
import { createFeatureFlags, type FeatureFlags } from "./flags.js";
import { createSafeLogger, type SafeLogger } from "./logger.js";
import { createErrorReporter, type ErrorReporter } from "./sentry.js";
import type { RuntimeEnvironment, ServiceName } from "./types.js";

export type DeliveryDisabledObservability = {
  readonly analytics: Analytics;
  readonly errors: ErrorReporter;
  readonly flags: FeatureFlags;
  readonly logger: SafeLogger;
};

export function createDeliveryDisabledObservability(options: {
  readonly service: ServiceName;
  readonly version: string;
  readonly environment: RuntimeEnvironment;
  readonly canaries?: ReadonlyArray<SensitiveCanary>;
}): DeliveryDisabledObservability {
  return {
    analytics: createAnalytics({ ...(options.canaries ? { canaries: options.canaries } : {}) }),
    errors: createErrorReporter(options),
    flags: createFeatureFlags(),
    logger: createSafeLogger(options),
  };
}

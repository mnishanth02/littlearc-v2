import { createDeliveryDisabledObservability } from "@littlearc/observability";

const appEnv = process.env.APP_ENV;

export const staffObservability = createDeliveryDisabledObservability({
  environment: appEnv === "staging" || appEnv === "production" ? appEnv : "local",
  service: "ops-web",
  version: "0.0.0",
});

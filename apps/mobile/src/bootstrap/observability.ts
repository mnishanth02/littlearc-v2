import { createDeliveryDisabledObservability } from "@littlearc/observability";
import { getMobileEnvironment } from "./environment";

const environment = getMobileEnvironment();

export const mobileObservability = createDeliveryDisabledObservability({
  environment: environment.appEnv,
  service: "mobile",
  version: "0.0.0",
});

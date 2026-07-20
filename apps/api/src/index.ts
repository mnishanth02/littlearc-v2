import { createSafeLogger } from "@littlearc/observability";
import { loadApiConfig } from "./config.js";
import { createApiServer } from "./server.js";

const config = loadApiConfig();
const logger = createSafeLogger({
  environment: config.appEnv,
  service: "api",
  sink(record) {
    console.log(JSON.stringify(record));
  },
  version: "0.0.0",
});
const server = await createApiServer(config, logger);

await server.listen({
  host: config.host,
  port: config.port,
});

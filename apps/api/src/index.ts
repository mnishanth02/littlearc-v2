import { loadApiConfig } from "./config.js";
import { createApiServer } from "./server.js";

const config = loadApiConfig();
const server = await createApiServer(config);

await server.listen({
  host: config.host,
  port: config.port,
});

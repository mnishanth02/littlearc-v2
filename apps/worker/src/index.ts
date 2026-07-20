import { createSafeLogger } from "@littlearc/observability";
import { loadWorkerConfig } from "./config.js";
import { createWorkerRuntime } from "./runtime.js";

const config = loadWorkerConfig();
const runtime = createWorkerRuntime(
  config,
  createSafeLogger({
    environment: config.appEnv,
    service: "worker",
    sink(record) {
      console.log(JSON.stringify(record));
    },
    version: "0.0.0",
  }),
);

runtime.start();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    runtime.stop();
    process.exit(0);
  });
}

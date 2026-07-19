import { loadWorkerConfig } from "./config.js";
import { createWorkerRuntime } from "./runtime.js";

const runtime = createWorkerRuntime(loadWorkerConfig(), {
  info(event) {
    console.log(JSON.stringify(event));
  },
});

runtime.start();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    runtime.stop();
    process.exit(0);
  });
}

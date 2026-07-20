import { spawn } from "node:child_process";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  throw new Error("A command is required for the local Aiven environment wrapper.");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be loaded from the untracked .env.aiven file.");
}

const child = spawn(command, args, {
  env: {
    ...process.env,
    APP_ENV: "local",
  },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("error", (error) => {
  console.error(`Could not start the local Aiven command: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});

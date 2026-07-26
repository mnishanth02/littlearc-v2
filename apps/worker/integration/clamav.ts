import { type ChildProcess, spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { createClamdScanner } from "../src/scanner/malware-scanner.js";

const commandTimeoutMs = 5 * 60 * 1_000;
const scannerTimeoutMs = 10_000;

let daemon: ChildProcess | undefined;
let workspace: string | undefined;

try {
  const prefix =
    process.env.CLAMAV_PREFIX?.trim() || (await commandOutput("brew", ["--prefix", "clamav"]));
  const freshclam = join(prefix, "bin", "freshclam");
  const clamd = join(prefix, "sbin", "clamd");
  workspace = await mkdtemp(join(tmpdir(), "littlearc-clamav-"));
  const databaseDirectory = join(workspace, "database");
  const temporaryDirectory = join(workspace, "temporary");
  await mkdir(databaseDirectory, { mode: 0o700 });
  await mkdir(temporaryDirectory, { mode: 0o700 });

  const freshclamConfig = join(workspace, "freshclam.conf");
  await writePrivateFile(
    freshclamConfig,
    [
      `DatabaseDirectory ${databaseDirectory}`,
      "DatabaseMirror database.clamav.net",
      "Checks 1",
      "ConnectTimeout 30",
      "ReceiveTimeout 120",
    ].join("\n"),
  );
  await runCommand(freshclam, ["--config-file", freshclamConfig, "--stdout"]);

  const port = await reserveLoopbackPort();
  const clamdConfig = join(workspace, "clamd.conf");
  await writePrivateFile(
    clamdConfig,
    [
      "Foreground yes",
      `DatabaseDirectory ${databaseDirectory}`,
      `TemporaryDirectory ${temporaryDirectory}`,
      "TCPAddr 127.0.0.1",
      `TCPSocket ${port}`,
      "MaxThreads 2",
      "MaxQueue 4",
      "MaxConnectionQueueLength 4",
      "StreamMaxLength 27M",
      "MaxFileSize 27M",
      "MaxScanSize 27M",
      "MaxRecursion 8",
      "ReadTimeout 30",
      "CommandReadTimeout 5",
      "SendBufTimeout 30",
      "ExitOnOOM yes",
    ].join("\n"),
  );
  daemon = spawn(clamd, ["--config-file", clamdConfig], {
    env: minimalEnvironment(),
    stdio: ["ignore", "ignore", "ignore"],
  });
  daemon.once("error", () => undefined);

  const observedAt = new Date();
  const scanner = createClamdScanner({
    host: "127.0.0.1",
    minimumSignatureVersion: 1,
    port,
    signatureMaxAgeHours: 1,
    signatureObservedAt: observedAt,
    timeoutMs: scannerTimeoutMs,
  });
  const readiness = await waitForReadiness(scanner.readiness);
  assert(readiness.status === "ready", "scanner readiness");
  assert((readiness.signatureVersion ?? 0) >= 1, "scanner signature version");

  const benign = Buffer.from(`LittleArc local scanner integration ${observedAt.toISOString()}`);
  const clean = await scanner.scan(Readable.from([benign]), { maxBytes: 1_024 });
  benign.fill(0);
  assert(clean.outcome === "clean", "benign scan");

  const eicar = Buffer.from(
    ["X5O!P%@AP[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"].join(""),
  );
  const detected = await scanner.scan(Readable.from([eicar]), { maxBytes: 1_024 });
  eicar.fill(0);
  assert(detected.outcome === "detected", "test-signature scan");

  const oversized = Buffer.alloc(9, 0x56);
  const rejected = await scanner.scan(Readable.from([oversized]), { maxBytes: 8 });
  oversized.fill(0);
  assert(rejected.outcome === "permanent_error", "client stream bound");

  await stopDaemon();
  const unavailable = await scanner.scan(Readable.from([Buffer.from([0x56])]), {
    maxBytes: 8,
  });
  assert(unavailable.outcome === "retryable_unavailable", "unavailable mapping");

  console.log(
    "Local ClamAV integration passed: readiness, clean, detected, bounded, unavailable, and cleanup.",
  );
} catch {
  console.error("Local ClamAV integration failed.");
  process.exitCode = 1;
} finally {
  await stopDaemon();
  if (workspace) {
    await rm(workspace, { force: true, recursive: true });
  }
}

async function waitForReadiness(
  readiness: ReturnType<typeof createClamdScanner>["readiness"],
): Promise<Awaited<ReturnType<typeof readiness>>> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const result = await readiness();
    if (result.status === "ready") {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return readiness();
}

async function reserveLoopbackPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  if (!address || typeof address === "string") {
    throw new Error("Loopback port allocation failed.");
  }
  return address.port;
}

async function writePrivateFile(path: string, value: string): Promise<void> {
  await writeFile(path, `${value}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(path, 0o600);
}

async function commandOutput(command: string, args: ReadonlyArray<string>): Promise<string> {
  const result = await captureCommand(command, args);
  const value = result.trim();
  if (!value) {
    throw new Error("Tool lookup failed.");
  }
  return value;
}

async function runCommand(command: string, args: ReadonlyArray<string>): Promise<void> {
  await captureCommand(command, args);
}

function captureCommand(command: string, args: ReadonlyArray<string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: minimalEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let capturedBytes = 0;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Tool execution timed out."));
    }, commandTimeoutMs);
    const capture = (chunk: Buffer) => {
      capturedBytes += chunk.length;
      if (capturedBytes > 1024 * 1024) {
        child.kill("SIGKILL");
        return;
      }
      chunks.push(Buffer.from(chunk));
    };
    child.stdout?.on("data", capture);
    child.stderr?.on("data", capture);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 || capturedBytes > 1024 * 1024) {
        reject(new Error("Tool execution failed."));
        return;
      }
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

async function stopDaemon(): Promise<void> {
  const current = daemon;
  daemon = undefined;
  if (!current || current.exitCode !== null || current.signalCode !== null) {
    return;
  }
  current.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise<boolean>((resolve) => current.once("exit", () => resolve(true))),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (!exited && current.exitCode === null && current.signalCode === null) {
    current.kill("SIGKILL");
    await new Promise<void>((resolve) => current.once("exit", () => resolve()));
  }
}

function minimalEnvironment(): NodeJS.ProcessEnv {
  return {
    HOME: process.env.HOME,
    LANG: "C",
    PATH: "/usr/local/bin:/usr/local/sbin:/usr/bin:/bin:/usr/sbin:/sbin",
    TMPDIR: process.env.TMPDIR,
  };
}

function assert(condition: boolean, _check: string): asserts condition {
  if (!condition) {
    throw new Error("Integration assertion failed.");
  }
}

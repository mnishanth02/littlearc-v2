import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { promisify } from "node:util";
import { createUuidV7 } from "@littlearc/domain";
import { loadWorkerConfig } from "./config.js";
import { createClamdScanner } from "./scanner/malware-scanner.js";
import { createWorkspaceManager } from "./workspace/workspace.js";

const execFileAsync = promisify(execFile);
const config = loadWorkerConfig();

if (config.appEnv !== "staging" || !config.fileValidation.enabled) {
  throw new Error("The file-validation staging probe requires the enabled staging boundary.");
}
if (config.fileValidation.previewsEnabled) {
  throw new Error("Preview derivation must remain disabled during VLT-05.");
}

const qpdfArguments = config.fileValidation.sandboxExecutable
  ? [
      "--no-new-privs",
      "/usr/bin/prlimit",
      "--as=536870912",
      "--cpu=30",
      "--fsize=16777216",
      "--nofile=64",
      "--nproc=8",
      "--",
      config.fileValidation.qpdfExecutable,
      "--version",
    ]
  : ["--version"];
await execFileAsync(
  config.fileValidation.sandboxExecutable ?? config.fileValidation.qpdfExecutable,
  qpdfArguments,
  {
    env: { LANG: "C", PATH: "/usr/bin:/bin" },
    timeout: 10_000,
    windowsHide: true,
  },
);

const scanner = createClamdScanner({
  host: config.fileValidation.clamdHost,
  minimumSignatureVersion: config.fileValidation.signatureMinimumVersion,
  port: config.fileValidation.clamdPort,
  signatureMaxAgeHours: config.fileValidation.signatureMaxAgeHours,
  signatureObservedAt: config.fileValidation.signatureObservedAt,
  timeoutMs: 30_000,
});
const scannerReadiness = await scanner.readiness();
if (scannerReadiness.status !== "ready") {
  throw new Error(
    `The private staging scanner readiness failed: ${scannerReadiness.status}; signatureVersion=${scannerReadiness.signatureVersion ?? "unavailable"}.`,
  );
}
const benign = await scanner.scan(Readable.from(Buffer.from("littlearc-vlt05-synthetic")), {
  maxBytes: 1024,
});
if (benign.outcome !== "clean") {
  throw new Error("The synthetic benign scanner probe was not clean.");
}
const eicar = ["X5O!P%@AP[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"].join(
  "",
);
const detected = await scanner.scan(Readable.from(Buffer.from(eicar)), {
  maxBytes: 1024,
});
if (detected.outcome !== "detected") {
  throw new Error("The synthetic scanner detection probe did not detect the test signature.");
}

const workspace = createWorkspaceManager(config.fileValidation.tmpDir);
await workspace.initialize();
const attemptId = createUuidV7(randomBytes(10));
await workspace.create(attemptId);
await workspace.cleanup(attemptId);
if ((await workspace.scavenge(new Date())).length !== 0) {
  throw new Error("The staging probe left a validation workspace behind.");
}

console.log(
  "VLT-05 staging probe passed: bounded QPDF sandbox, fresh private scanner, clean/detected matrix, previews off, and workspace cleanup.",
);

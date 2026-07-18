import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function createBuildMetadata({
  environment,
  lockfilePath = "pnpm-lock.yaml",
  nodeVersion = process.version,
  pnpmVersion,
  generatedAt = new Date().toISOString(),
}) {
  const sourceCommit = environment.GITHUB_SHA;
  if (!sourceCommit || !/^[0-9a-f]{40}$/.test(sourceCommit)) {
    throw new Error("GITHUB_SHA must contain the 40-character commit tested by CI.");
  }
  if (!pnpmVersion) {
    throw new Error("pnpmVersion is required.");
  }
  const pullRequestHeadCommit = environment.GITHUB_HEAD_SHA || null;
  if (pullRequestHeadCommit && !/^[0-9a-f]{40}$/.test(pullRequestHeadCommit)) {
    throw new Error("GITHUB_HEAD_SHA must be a 40-character commit when present.");
  }

  return {
    schemaVersion: 1,
    repository: environment.GITHUB_REPOSITORY ?? "local/unknown",
    sourceCommit,
    pullRequestHeadCommit,
    sourceRef: environment.GITHUB_REF ?? "local",
    workflow: environment.GITHUB_WORKFLOW ?? "local",
    runId: environment.GITHUB_RUN_ID ?? "local",
    runAttempt: environment.GITHUB_RUN_ATTEMPT ?? "1",
    lockfileSha256: sha256File(lockfilePath),
    nodeVersion,
    pnpmVersion,
    generatedAt,
  };
}

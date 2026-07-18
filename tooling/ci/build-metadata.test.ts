import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createBuildMetadata } from "./build-metadata.mjs";

describe("build metadata", () => {
  it("maps an exact source commit and lockfile digest without environment leakage", () => {
    const metadata = createBuildMetadata({
      environment: {
        GITHUB_SHA: "a".repeat(40),
        GITHUB_HEAD_SHA: "b".repeat(40),
        GITHUB_REPOSITORY: "littlearc/littlearc",
        GITHUB_REF: "refs/pull/42/merge",
        GITHUB_WORKFLOW: "CI",
        GITHUB_RUN_ID: "100",
        GITHUB_RUN_ATTEMPT: "2",
        SHOULD_NOT_LEAK: "synthetic-secret",
      },
      pnpmVersion: "11.14.0",
      generatedAt: "2026-07-18T00:00:00.000Z",
    });

    const expectedDigest = createHash("sha256")
      .update(readFileSync("pnpm-lock.yaml"))
      .digest("hex");
    expect(metadata).toMatchObject({
      sourceCommit: "a".repeat(40),
      pullRequestHeadCommit: "b".repeat(40),
      lockfileSha256: expectedDigest,
      pnpmVersion: "11.14.0",
    });
    expect(JSON.stringify(metadata)).not.toContain("synthetic-secret");
  });

  it("rejects metadata that cannot identify the tested commit", () => {
    expect(() =>
      createBuildMetadata({
        environment: { GITHUB_SHA: "not-a-commit" },
        pnpmVersion: "11.14.0",
      }),
    ).toThrow("GITHUB_SHA");
  });
});

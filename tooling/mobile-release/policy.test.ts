import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inspectMobileReleaseBundle } from "./policy.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("mobile release bundle validation policy", () => {
  it("accepts a release bundle without development validation content", () => {
    const bundleRoot = createBundle();
    writeFileSync(join(bundleRoot, "index.hbc"), Buffer.from("LittleArc production bundle"));

    expect(inspectMobileReleaseBundle(bundleRoot)).toEqual({
      filesInspected: 1,
      leaks: [],
    });
  });

  it("reports the file and every matching validation canary", () => {
    const bundleRoot = createBundle();
    const bundleDirectory = join(bundleRoot, "_expo", "static", "js");
    mkdirSync(bundleDirectory, { recursive: true });
    writeFileSync(
      join(bundleDirectory, "index.hbc"),
      Buffer.from("off06-device-validation /v1/validation/off06/session"),
    );

    expect(inspectMobileReleaseBundle(bundleRoot).leaks).toEqual([
      {
        canary: "off06-device-validation",
        file: join("_expo", "static", "js", "index.hbc"),
      },
      {
        canary: "/v1/validation/",
        file: join("_expo", "static", "js", "index.hbc"),
      },
    ]);
  });

  it("fails closed when the release bundle is missing or empty", () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "littlearc-mobile-release-missing-"));
    temporaryDirectories.push(repositoryRoot);

    expect(() => inspectMobileReleaseBundle(join(repositoryRoot, "missing"))).toThrow(
      "does not exist",
    );
    expect(() => inspectMobileReleaseBundle(createBundle())).toThrow("contains no files");
  });
});

function createBundle(): string {
  const bundleRoot = mkdtempSync(join(tmpdir(), "littlearc-mobile-release-"));
  temporaryDirectories.push(bundleRoot);
  return bundleRoot;
}

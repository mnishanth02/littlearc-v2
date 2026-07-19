import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateRailwayStagingSkeleton } from "./policy.mjs";

describe("Railway staging skeleton policy", () => {
  it("accepts the committed staging skeleton", () => {
    expect(validateRailwayStagingSkeleton(process.cwd())).toEqual([]);
  });

  it("rejects production descriptors during the staging-only FND-06 scope", () => {
    const repositoryRoot = makeSkeleton();
    mkdirSync(join(repositoryRoot, "infra/railway/production"), { recursive: true });

    expect(validateRailwayStagingSkeleton(repositoryRoot).join("\n")).toContain(
      "infra/railway/production must remain absent",
    );
  });

  it("rejects committed variable values", () => {
    const repositoryRoot = makeSkeleton();
    const manifestPath = join(repositoryRoot, "infra/railway/staging/variables.manifest.json");
    const manifest = JSON.parse(readFixture("variables.manifest.json"));
    manifest.services[0].requiredVariables[3].value = "postgres://must-not-commit";
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    expect(validateRailwayStagingSkeleton(repositoryRoot).join("\n")).toContain(
      "DATABASE_URL must not contain a value",
    );
  });
});

function makeSkeleton() {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "littlearc-railway-"));
  const stagingRoot = join(repositoryRoot, "infra/railway/staging");
  mkdirSync(stagingRoot, { recursive: true });

  for (const filename of [
    "api.railway.json",
    "worker.railway.json",
    "ops-web.railway.json",
    "variables.manifest.json",
  ]) {
    writeFileSync(join(stagingRoot, filename), readFixture(filename));
  }

  return repositoryRoot;
}

function readFixture(filename: string) {
  return readFileSyncFromRoot(join("infra/railway/staging", filename));
}

function readFileSyncFromRoot(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

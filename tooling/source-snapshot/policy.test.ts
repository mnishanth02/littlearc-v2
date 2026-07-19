import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { existingSnapshotFiles } from "./policy.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true });
  }
});

describe("source snapshot policy", () => {
  it("skips tracked paths deleted from the working tree and directories", () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "littlearc-source-snapshot-"));
    temporaryDirectories.push(repositoryRoot);
    writeFileSync(join(repositoryRoot, "kept.ts"), "export const kept = true;\n");
    mkdirSync(join(repositoryRoot, "folder"));

    expect(existingSnapshotFiles(repositoryRoot, ["kept.ts", "deleted.ts", "folder"])).toEqual([
      "kept.ts",
    ]);
  });
});

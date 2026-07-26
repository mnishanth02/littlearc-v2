import { mkdtemp, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { UuidV7 } from "@littlearc/domain";
import { afterEach, describe, expect, it } from "vitest";
import { createWorkspaceManager } from "./workspace.js";

const attemptId = "019f8000-0000-7000-8000-000000000001" as UuidV7;
const roots: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("validation workspace", () => {
  it("creates opaque private workspaces and verifies cleanup", async () => {
    const parent = await mkdtemp(join(tmpdir(), "littlearc-workspace-test-"));
    roots.push(parent);
    const manager = createWorkspaceManager(join(parent, "validation"));
    await manager.initialize();
    const workspace = await manager.create(attemptId);
    await writeFile(workspace.inputPath, "synthetic", { mode: 0o600 });
    expect(workspace.path).not.toContain("filename");
    await manager.cleanup(attemptId);
    await expect(stat(workspace.path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("scavenges only stale opaque attempt directories", async () => {
    const parent = await mkdtemp(join(tmpdir(), "littlearc-workspace-test-"));
    roots.push(parent);
    const manager = createWorkspaceManager(join(parent, "validation"));
    await manager.initialize();
    const workspace = await manager.create(attemptId);
    await utimes(workspace.path, new Date(0), new Date(0));
    expect(await manager.scavenge(new Date())).toEqual([attemptId]);
  });

  it("rejects roots outside the platform temp directory and symlink roots", async () => {
    expect(() => createWorkspaceManager("/")).toThrow();
    const parent = await mkdtemp(join(tmpdir(), "littlearc-workspace-test-"));
    roots.push(parent);
    const target = join(parent, "target");
    const link = join(parent, "link");
    const targetManager = createWorkspaceManager(target);
    await targetManager.initialize();
    await symlink(target, link);
    await expect(createWorkspaceManager(link).initialize()).rejects.toThrow();
  });
});

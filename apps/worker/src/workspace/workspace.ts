import { constants } from "node:fs";
import { access, chmod, lstat, mkdir, opendir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { UuidV7 } from "@littlearc/domain";

export type ValidationWorkspace = {
  readonly attemptId: UuidV7;
  readonly ciphertextPartPath: string;
  readonly inputPartPath: string;
  readonly inputPath: string;
  readonly path: string;
  readonly previewCiphertextPartPath: string;
  readonly previewPlaintextPartPath: string;
  readonly renderIntermediatePath: string;
};

const attemptPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function createWorkspaceManager(rootInput: string) {
  const root = validateRootPath(rootInput);

  return {
    async initialize(): Promise<void> {
      await mkdir(root, { mode: 0o700, recursive: true });
      const rootStat = await lstat(root);
      if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
        throw new Error("Validation workspace root must be a real directory.");
      }
      await chmod(root, 0o700);
      await access(root, constants.R_OK | constants.W_OK | constants.X_OK);
    },
    async create(attemptId: UuidV7): Promise<ValidationWorkspace> {
      assertAttemptId(attemptId);
      const path = join(root, attemptId);
      await mkdir(path, { mode: 0o700 });
      await chmod(path, 0o700);
      return {
        attemptId,
        ciphertextPartPath: join(path, "ciphertext.part"),
        inputPartPath: join(path, "input.part"),
        inputPath: join(path, "input.bin"),
        path,
        previewCiphertextPartPath: join(path, "preview-ciphertext.part"),
        previewPlaintextPartPath: join(path, "preview-plaintext.part"),
        renderIntermediatePath: join(path, "render-intermediate.bin"),
      };
    },
    async cleanup(attemptId: UuidV7): Promise<void> {
      assertAttemptId(attemptId);
      const path = join(root, attemptId);
      await rm(path, { force: true, maxRetries: 3, recursive: true, retryDelay: 100 });
      try {
        await stat(path);
        throw new Error("Validation workspace cleanup did not remove the attempt.");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    },
    async scavenge(
      olderThan: Date,
      activeAttempts: ReadonlySet<string> = new Set(),
    ): Promise<ReadonlyArray<UuidV7>> {
      const removed: UuidV7[] = [];
      const directory = await opendir(root);
      for await (const entry of directory) {
        if (
          !entry.isDirectory() ||
          !attemptPattern.test(entry.name) ||
          activeAttempts.has(entry.name)
        ) {
          continue;
        }
        const path = join(root, entry.name);
        const entryStat = await lstat(path);
        if (entryStat.isSymbolicLink() || entryStat.mtimeMs >= olderThan.getTime()) {
          continue;
        }
        await rm(path, { force: true, maxRetries: 3, recursive: true, retryDelay: 100 });
        removed.push(entry.name as UuidV7);
      }
      return removed;
    },
    root,
  };
}

function validateRootPath(rootInput: string): string {
  if (!isAbsolute(rootInput)) {
    throw new Error("Validation workspace root must be absolute.");
  }
  const root = resolve(rootInput);
  const temporaryRoot = resolve(tmpdir());
  const child = relative(temporaryRoot, root);
  if (!child || child.startsWith("..") || isAbsolute(child)) {
    throw new Error(
      "Validation workspace root must be a dedicated child of the platform temp root.",
    );
  }
  return root;
}

function assertAttemptId(attemptId: string): void {
  if (!attemptPattern.test(attemptId)) {
    throw new Error("Validation attempt ID must be an opaque UUIDv7.");
  }
}

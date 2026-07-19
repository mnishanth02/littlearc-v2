import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

export function existingSnapshotFiles(repositoryRoot, files) {
  return files.filter((file) => {
    const source = resolve(repositoryRoot, file);
    return existsSync(source) && statSync(source).isFile();
  });
}

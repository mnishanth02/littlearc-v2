import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const destination = process.argv[2];
if (!destination) {
  throw new Error("Usage: node tooling/create-source-snapshot.mjs <destination>");
}

const repositoryRoot = resolve(import.meta.dirname, "..");
const output = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: repositoryRoot },
);
const files = output
  .toString("utf8")
  .split("\0")
  .filter(Boolean);

for (const file of files) {
  const source = resolve(repositoryRoot, file);
  if (!statSync(source).isFile()) {
    continue;
  }
  const target = resolve(destination, file);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

console.log(`Created source-only snapshot with ${files.length} files at ${destination}`);

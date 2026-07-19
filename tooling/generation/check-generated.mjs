import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const manifestUrl = new URL("./manifest.json", import.meta.url);
const manifest = JSON.parse(readFileSync(manifestUrl, "utf8"));

if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.generators)) {
  throw new Error("Generated-output manifest must use schemaVersion 1 and a generators array.");
}

const names = new Set();

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function collectOutputHashes(path) {
  if (!existsSync(path)) {
    return new Map([[path, null]]);
  }

  const stat = statSync(path);
  if (stat.isFile()) {
    return new Map([[path, hashFile(path)]]);
  }

  if (!stat.isDirectory()) {
    return new Map([[path, "unsupported-output-kind"]]);
  }

  const hashes = new Map();
  const entries = readdirSync(path, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  for (const entry of entries) {
    const childPath = join(path, entry.name);
    for (const [file, hash] of collectOutputHashes(childPath)) {
      hashes.set(file, hash);
    }
  }

  return hashes;
}

function collectAllOutputHashes(outputs) {
  const hashes = new Map();

  for (const output of outputs) {
    for (const [file, hash] of collectOutputHashes(output)) {
      hashes.set(file, hash);
    }
  }

  return hashes;
}

function changedOutputs(before, after) {
  const paths = new Set([...before.keys(), ...after.keys()]);

  return [...paths].filter((path) => before.get(path) !== after.get(path)).sort();
}

for (const generator of manifest.generators) {
  if (
    typeof generator.name !== "string" ||
    generator.name.length === 0 ||
    !Array.isArray(generator.command) ||
    generator.command.length === 0 ||
    !generator.command.every((part) => typeof part === "string" && part.length > 0) ||
    !Array.isArray(generator.outputs) ||
    generator.outputs.length === 0 ||
    !generator.outputs.every((output) => typeof output === "string" && output.length > 0)
  ) {
    throw new Error("Every generator needs a name, non-empty command, and non-empty outputs.");
  }

  if (names.has(generator.name)) {
    throw new Error("Duplicate generated-output entry: " + generator.name);
  }
  names.add(generator.name);

  const before = collectAllOutputHashes(generator.outputs);

  execFileSync(generator.command[0], generator.command.slice(1), {
    cwd: process.cwd(),
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  const after = collectAllOutputHashes(generator.outputs);
  const changed = changedOutputs(before, after);

  if (changed.length > 0) {
    throw new Error(
      `Generated-output drift detected for ${generator.name}: ${changed.join(", ")}`,
    );
  }
}

console.log(
  "Generated-output drift check passed (" + manifest.generators.length + " registered).",
);

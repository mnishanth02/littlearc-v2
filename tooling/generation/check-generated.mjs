import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";

const manifestUrl = new URL("./manifest.json", import.meta.url);
const manifest = JSON.parse(readFileSync(manifestUrl, "utf8"));

if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.generators)) {
  throw new Error("Generated-output manifest must use schemaVersion 1 and a generators array.");
}

const names = new Set();

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

  execFileSync(generator.command[0], generator.command.slice(1), {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  execFileSync("git", ["diff", "--exit-code", "--", ...generator.outputs], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}

console.log(
  "Generated-output drift check passed (" + manifest.generators.length + " registered).",
);

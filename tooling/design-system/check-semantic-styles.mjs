import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findSemanticStyleViolations } from "./policy.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoots = ["apps/mobile/app", "apps/mobile/src/components", "apps/mobile/src/theme"];
const sourceExtensions = new Set([".ts", ".tsx"]);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const violations = sourceRoots.flatMap((sourceRoot) =>
  walk(join(repositoryRoot, sourceRoot)).flatMap((file) => {
    if (!sourceExtensions.has(extname(file))) {
      return [];
    }

    const relativeFile = relative(repositoryRoot, file);
    return findSemanticStyleViolations(relativeFile, readFileSync(file, "utf8"));
  }),
);

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`design_system_violation: ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log("Design-system semantic style policy verified");
}

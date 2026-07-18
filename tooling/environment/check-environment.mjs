import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateEnvironmentEntries } from "./policy.mjs";
import { environmentCatalog } from "./variables.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const violations = [];

function parseExample(path) {
  const entries = new Map();
  const lines = readFileSync(path, "utf8").split("\n");

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator < 1) {
      violations.push(`${path}:${index + 1}: expected NAME=value`);
      continue;
    }

    const name = line.slice(0, separator);
    const value = line.slice(separator + 1);
    if (entries.has(name)) {
      violations.push(`${path}:${index + 1}: duplicate variable ${name}`);
    }
    entries.set(name, value);
  }

  return entries;
}

for (const [relativePath, catalog] of Object.entries(environmentCatalog)) {
  const entries = parseExample(resolve(repositoryRoot, relativePath));

  violations.push(...validateEnvironmentEntries(relativePath, catalog, entries));
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`environment_contract_violation: ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Environment templates verified: ${Object.keys(environmentCatalog).length} applications`);
}

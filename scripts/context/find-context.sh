#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
QUERY="${1:-}"
MAP_FILE="$ROOT_DIR/docs/context-map.yaml"

if [ -z "$QUERY" ]; then
  printf 'Usage: %s "<feature, module, or task query>"\n' "$0" >&2
  exit 64
fi

if [ ! -f "$MAP_FILE" ]; then
  printf 'Missing context map: %s\n' "$MAP_FILE" >&2
  exit 66
fi

node --input-type=module - "$ROOT_DIR" "$MAP_FILE" "$QUERY" <<'NODE'
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import YAML from "yaml";

const [rootDir, mapFile, query] = process.argv.slice(2);
const queryLower = query.toLowerCase();
const queryTerms = queryLower
  .split(/[^a-z0-9@._/-]+/u)
  .filter((term) => term.length >= 2);

const document = YAML.parse(fs.readFileSync(mapFile, "utf8"));
const domains = document?.domains ?? {};

const scoreDomain = ([name, domain]) => {
  const haystack = [
    name,
    ...(domain.keywords ?? []),
    ...(domain.docs ?? []),
    ...(domain.code ?? []),
    ...(domain.tests ?? []),
    ...(domain.validation ?? []),
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  if (haystack.includes(queryLower)) {
    score += 8;
  }
  for (const term of queryTerms) {
    if (name.toLowerCase().includes(term)) {
      score += 5;
    }
    const termMatches = haystack.match(new RegExp(escapeRegExp(term), "gu"));
    score += termMatches?.length ?? 0;
  }
  return { name, domain, score };
};

const scored = Object.entries(domains)
  .map(scoreDomain)
  .filter((entry) => entry.score > 0)
  .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  .slice(0, 3);

const selected = scored.length > 0 ? scored : [{ name: "foundation", domain: domains.foundation ?? {}, score: 0 }];

const unique = (items) => [...new Set(items.filter(Boolean))];
const collect = (field) => unique(selected.flatMap((entry) => entry.domain[field] ?? []));

const pathExists = (relativePath) => {
  if (relativePath.includes("*")) {
    const prefix = relativePath.split("*", 1)[0].replace(/\/+$/u, "");
    return fs.existsSync(path.join(rootDir, prefix));
  }
  return fs.existsSync(path.join(rootDir, relativePath));
};

const printSection = (title, items, { checkPath = false } = {}) => {
  console.log(`${title}:`);
  if (items.length === 0) {
    console.log("- None mapped yet");
    console.log("");
    return;
  }
  for (const item of items) {
    const suffix = checkPath && !pathExists(item) ? " (missing or pending)" : "";
    console.log(`- ${item}${suffix}`);
  }
  console.log("");
};

console.log(`Matched domains: ${selected.map((entry) => entry.name).join(", ")}`);
console.log("");
printSection("Relevant documentation", collect("docs"), { checkPath: true });
printSection("Relevant code", collect("code"), { checkPath: true });
printSection("Relevant tests", collect("tests"), { checkPath: true });
printSection("Relevant validation", collect("validation"));

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
NODE

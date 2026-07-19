#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MAP_FILE="$ROOT_DIR/docs/context-map.yaml"

node --input-type=module - "$ROOT_DIR" "$MAP_FILE" <<'NODE'
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import YAML from "yaml";

const [rootDir, mapFile] = process.argv.slice(2);
const errors = [];

const requiredFiles = [
  "AGENTS.md",
  "docs/IMPLEMENTATION_STATUS.md",
  "docs/index.md",
  "docs/context-map.yaml",
  "docs/core/README.md",
  "docs/impl-plan/README.md",
  "docs/adr/README.md",
  "docs/reference/README.md",
  "docs/templates/README.md",
];

for (const relativePath of requiredFiles) {
  requireExistingPath(relativePath);
}

const contextMap = readYaml("docs/context-map.yaml");
const domains = contextMap?.domains;
if (!domains || typeof domains !== "object" || Array.isArray(domains)) {
  errors.push("docs/context-map.yaml must contain a domains object.");
} else {
  for (const [name, domain] of Object.entries(domains)) {
    if (!Array.isArray(domain.keywords) || domain.keywords.length === 0) {
      errors.push(`Context domain ${name} must define at least one keyword.`);
    }
    for (const field of ["docs", "code", "tests"]) {
      for (const mappedPath of domain[field] ?? []) {
        if (!mappedPathExists(mappedPath)) {
          errors.push(`Context domain ${name} maps missing ${field} path: ${mappedPath}`);
        }
      }
    }
    if (!Array.isArray(domain.validation)) {
      errors.push(`Context domain ${name} must define validation as a list.`);
    }
  }
}

for (const markdownPath of listMarkdownFiles("docs")) {
  const relativePath = toRelative(markdownPath);
  const text = fs.readFileSync(markdownPath, "utf8");
  validateMetadata(relativePath, text);
  validateMarkdownLinks(relativePath, text);
  validateAdrStatus(relativePath, text);
}

if (errors.length > 0) {
  console.error("Documentation validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Documentation validation passed.");

function requireExistingPath(relativePath) {
  if (!fs.existsSync(path.join(rootDir, relativePath))) {
    errors.push(`Missing required path: ${relativePath}`);
  }
}

function readYaml(relativePath) {
  try {
    return YAML.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
  } catch (error) {
    errors.push(`Could not parse ${relativePath}: ${error.message}`);
    return null;
  }
}

function mappedPathExists(mappedPath) {
  if (mappedPath.includes("*")) {
    const prefix = mappedPath.split("*", 1)[0].replace(/\/+$/u, "");
    return fs.existsSync(path.join(rootDir, prefix));
  }
  return fs.existsSync(path.join(rootDir, mappedPath));
}

function listMarkdownFiles(relativeDir) {
  const startDir = path.join(rootDir, relativeDir);
  const results = [];
  walk(startDir, results);
  return results;
}

function walk(currentPath, results) {
  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") {
      continue;
    }
    const entryPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath, results);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(entryPath);
    }
  }
}

function validateMetadata(relativePath, text) {
  if (relativePath.startsWith("docs/templates/")) {
    return;
  }
  const statusPattern = /^>\s+\*\*Status:\*\*/mu;
  const datePattern = /^>\s+\*\*(Last updated|Date):\*\*/mu;
  if (!statusPattern.test(text)) {
    errors.push(`${relativePath} is missing blockquote Status metadata.`);
  }
  if (!datePattern.test(text)) {
    errors.push(`${relativePath} is missing blockquote Last updated or Date metadata.`);
  }
}

function validateAdrStatus(relativePath, text) {
  if (!relativePath.startsWith("docs/adr/") || relativePath.endsWith("README.md")) {
    return;
  }
  const status = text.match(/^>\s+\*\*Status:\*\*\s*(.+)$/mu)?.[1]?.trim();
  const validStatuses = new Set(["Proposed", "Accepted", "Superseded"]);
  if (!status || !validStatuses.has(status)) {
    errors.push(`${relativePath} must have ADR status Proposed, Accepted, or Superseded.`);
  }

  const requiredMetadata = ["Date", "Owner", "Review date", "Supersedes", "Superseded by"];
  for (const field of requiredMetadata) {
    const pattern = new RegExp(`^>\\s+\\*\\*${field}:\\*\\*\\s+\\S`, "mu");
    if (!pattern.test(text)) {
      errors.push(`${relativePath} is missing ADR metadata: ${field}.`);
    }
  }

  const requiredSections = [
    "Context",
    "Decision",
    "Alternatives Considered",
    "Consequences",
    "Validation",
    "Review Triggers",
  ];
  for (const section of requiredSections) {
    const pattern = new RegExp(`^## ${section}$`, "mu");
    if (!pattern.test(text)) {
      errors.push(`${relativePath} is missing ADR section: ${section}.`);
    }
  }

  if (status === "Superseded") {
    const successor = text.match(/^>\s+\*\*Superseded by:\*\*\s+(.+)$/mu)?.[1]?.trim();
    if (!successor || successor === "None") {
      errors.push(`${relativePath} is Superseded but does not identify its superseding ADR.`);
    }
  }
}

function validateMarkdownLinks(relativePath, text) {
  const linkPattern = /\[[^\]]+\]\((?!https?:\/\/|mailto:|#)([^)\s]+)(?:\s+"[^"]*")?\)/gu;
  const sourceDir = path.dirname(path.join(rootDir, relativePath));
  for (const match of text.matchAll(linkPattern)) {
    const target = decodeURIComponent(match[1].split("#", 1)[0]);
    if (!target || target.startsWith("<") || target.includes("*")) {
      continue;
    }
    const resolved = path.resolve(sourceDir, target);
    if (!resolved.startsWith(rootDir) || !fs.existsSync(resolved)) {
      errors.push(`${relativePath} links to missing local target: ${match[1]}`);
    }
  }
}

function toRelative(absolutePath) {
  return path.relative(rootDir, absolutePath).replaceAll(path.sep, "/");
}
NODE

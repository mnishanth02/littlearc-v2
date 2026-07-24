import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";

export const validationBundleCanaries = [
  "x-littlearc-synthetic-session",
  "off01-device-validation",
  "off02-device-validation",
  "off03-device-validation",
  "off04-device-validation",
  "off05-device-validation",
  "off06-device-validation",
  "vlt01-device-validation",
  "vlt02-summary",
  "Synthetic manual prescription",
  "synthetic-approved-off-02",
  "/v1/validation/",
  "OFF-01 device validation",
  "OFF-02 device validation",
  "OFF-03 device validation",
  "OFF-04 device validation",
  "OFF-05 device validation",
  "OFF-06 synthetic activation validation passed",
  "VLT-01 device validation passed",
  "VLT-02 device validation passed",
  "Synthetic critical note",
];

export function inspectMobileReleaseBundle(bundleRoot) {
  const absoluteRoot = resolve(bundleRoot);
  if (!existsSync(absoluteRoot)) {
    throw new Error(`Mobile release bundle does not exist: ${absoluteRoot}`);
  }

  const files = collectFiles(absoluteRoot);
  if (files.length === 0) {
    throw new Error(`Mobile release bundle contains no files: ${absoluteRoot}`);
  }

  const leaks = [];
  for (const file of files) {
    const content = readFileSync(file);
    for (const canary of validationBundleCanaries) {
      if (content.includes(Buffer.from(canary))) {
        leaks.push({
          canary,
          file: relative(absoluteRoot, file),
        });
      }
    }
  }

  return {
    filesInspected: files.length,
    leaks,
  };
}

function collectFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

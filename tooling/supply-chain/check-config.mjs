import { readFileSync } from "node:fs";

const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
const renovate = JSON.parse(readFileSync("renovate.json", "utf8"));
const lockfile = readFileSync("pnpm-lock.yaml", "utf8");

if (rootPackage.packageManager !== "pnpm@11.14.0") {
  throw new Error("Root packageManager must remain exactly pnpm@11.14.0.");
}
if (!lockfile.includes("lockfileVersion:")) {
  throw new Error("The committed pnpm lockfile is missing its format version.");
}
if (
  renovate.rangeStrategy !== "pin" ||
  !renovate.extends?.includes("helpers:pinGitHubActionDigests") ||
  !renovate.ignorePaths?.includes("spikes/native-compat/**")
) {
  throw new Error(
    "Renovate must pin dependencies and actions while preserving the retained M0 spike.",
  );
}

console.log("Supply-chain configuration passed.");

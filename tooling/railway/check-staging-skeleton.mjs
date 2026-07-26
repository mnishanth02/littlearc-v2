import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRailwayStagingSkeleton } from "./policy.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const violations = validateRailwayStagingSkeleton(repositoryRoot);

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`railway_skeleton_violation: ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log("Railway staging skeleton verified: 4 services, 1 PostgreSQL, 2 buckets");
}

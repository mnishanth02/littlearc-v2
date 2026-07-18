import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadAndValidateWorkflow } from "./policy.mjs";

const workflowDirectory = resolve(".github/workflows");
const workflowPaths = readdirSync(workflowDirectory)
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort()
  .map((name) => resolve(workflowDirectory, name));

if (workflowPaths.length === 0) {
  throw new Error("At least one GitHub Actions workflow is required.");
}

const errors = workflowPaths.flatMap(loadAndValidateWorkflow);
if (errors.length > 0) {
  throw new Error("Workflow policy failed:\n- " + errors.join("\n- "));
}

console.log("Workflow policy passed (" + workflowPaths.length + " workflows).");

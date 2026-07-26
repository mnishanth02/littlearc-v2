import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

const immutableAction = /^[^./][^@]*@[0-9a-f]{40}$/;

function permissionErrors(permissions, location, allowSecurityEventsWrite = false) {
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
    return [location + " must declare an explicit permissions map."];
  }

  return Object.entries(permissions)
    .filter(
      ([scope, access]) =>
        (scope !== "contents" || access !== "read") &&
        (!allowSecurityEventsWrite || scope !== "security-events" || access !== "write"),
    )
    .map(
      ([scope, access]) =>
        location +
        " grants " +
        scope +
        ": " +
        String(access) +
        "; only contents: read is allowed.",
    );
}

export function validateWorkflowDocument(workflow, fileName) {
  const errors = [];
  const isCodeQlWorkflow = resolve(fileName) === resolve(".github/workflows/codeql.yml");
  errors.push(
    ...permissionErrors(
      workflow.permissions,
      fileName + " top-level permissions",
      isCodeQlWorkflow,
    ),
  );

  if (workflow.on?.pull_request_target !== undefined) {
    errors.push(fileName + " must not use pull_request_target.");
  }

  if (!workflow.jobs || typeof workflow.jobs !== "object") {
    return [...errors, fileName + " must define jobs."];
  }

  for (const [jobId, job] of Object.entries(workflow.jobs)) {
    const location = fileName + " job " + jobId;
    if (!Number.isInteger(job["timeout-minutes"]) || job["timeout-minutes"] <= 0) {
      errors.push(location + " must set a positive timeout-minutes.");
    }

    if (job.permissions) {
      errors.push(...permissionErrors(job.permissions, location + " permissions", isCodeQlWorkflow));
    }

    if (job.environment !== undefined) {
      errors.push(location + " must not target an environment before a release workflow is approved.");
    }

    for (const [index, step] of (job.steps ?? []).entries()) {
      if (!step.uses) {
        continue;
      }

      if (!step.uses.startsWith("./") && !immutableAction.test(step.uses)) {
        errors.push(
          location + " step " + (index + 1) + " must pin " + step.uses + " to a full commit SHA.",
        );
      }

      if (
        step.uses.startsWith("actions/checkout@") &&
        step.with?.["persist-credentials"] !== false
      ) {
        errors.push(location + " checkout must set persist-credentials: false.");
      }

      if (step.uses.startsWith("actions/cache@")) {
        errors.push(location + " must use setup-node pnpm caching, not a general-purpose cache.");
      }

      if (step.uses.startsWith("actions/setup-node@")) {
        if (
          step.with?.cache !== "pnpm" ||
          step.with?.["cache-dependency-path"] !== "pnpm-lock.yaml"
        ) {
          errors.push(location + " setup-node cache must be scoped to pnpm-lock.yaml.");
        }
      }

      if (/(deploy|railway|eas-action)/i.test(step.uses)) {
        errors.push(location + " contains a deployment action before release controls are approved.");
      }
    }
  }

  return errors;
}

export function loadAndValidateWorkflow(path) {
  const workflow = parse(readFileSync(path, "utf8"));
  return validateWorkflowDocument(workflow, path);
}

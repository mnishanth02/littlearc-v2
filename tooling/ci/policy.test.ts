import { describe, expect, it } from "vitest";
import { validateWorkflowDocument } from "./policy.mjs";

const safeWorkflow = {
  on: { pull_request: {} },
  permissions: { contents: "read" },
  jobs: {
    quality: {
      "timeout-minutes": 10,
      steps: [
        {
          uses: `actions/checkout@${"a".repeat(40)}`,
          with: { "persist-credentials": false },
        },
      ],
    },
  },
};

describe("workflow policy", () => {
  it("accepts a read-only workflow with immutable action pins", () => {
    expect(validateWorkflowDocument(safeWorkflow, "safe.yml")).toEqual([]);
  });

  it("rejects mutable action references and persisted credentials", () => {
    const workflow = structuredClone(safeWorkflow);
    workflow.jobs.quality.steps[0] = {
      uses: "actions/checkout@v6",
      with: { "persist-credentials": true },
    };

    expect(validateWorkflowDocument(workflow, "unsafe.yml")).toEqual(
      expect.arrayContaining([
        expect.stringContaining("full commit SHA"),
        expect.stringContaining("persist-credentials: false"),
      ]),
    );
  });

  it("rejects privileged triggers, permissions, environments, and caches", () => {
    const workflow = {
      on: { pull_request_target: {} },
      permissions: { contents: "write" },
      jobs: {
        deploy: {
          environment: "production",
          steps: [{ uses: `actions/cache@${"b".repeat(40)}` }],
        },
      },
    };

    expect(validateWorkflowDocument(workflow, "unsafe.yml")).toEqual(
      expect.arrayContaining([
        expect.stringContaining("pull_request_target"),
        expect.stringContaining("contents: write"),
        expect.stringContaining("timeout-minutes"),
        expect.stringContaining("must not target an environment"),
        expect.stringContaining("general-purpose cache"),
      ]),
    );
  });
});

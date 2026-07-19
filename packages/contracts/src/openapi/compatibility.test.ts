import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { openApiDocument } from "../generated/openapi-document.js";
import { detectBreakingContractChanges } from "./compatibility.js";

const baselineJson = readFileSync(
  new URL("../../baseline/openapi-v1-baseline.json", import.meta.url),
  "utf8",
);
const baseline = JSON.parse(baselineJson);

describe("contract compatibility guard", () => {
  it("accepts the committed baseline", () => {
    expect(detectBreakingContractChanges(baseline, openApiDocument)).toEqual([]);
  });

  it("keeps UUIDv7 patterns compatible with OpenAPI regex syntax", () => {
    expect(baselineJson).not.toContain("$/i");
    expect(JSON.stringify(openApiDocument)).not.toContain("$/i");
  });

  it("detects removed paths, methods, and responses", () => {
    expect(
      detectBreakingContractChanges({ paths: { "/v1/removed": {} } }, openApiDocument),
    ).toEqual([{ kind: "path_removed", location: "/v1/removed" }]);
    expect(
      detectBreakingContractChanges(
        { paths: { "/v1": { get: { responses: { 200: {} } } } } },
        { paths: { "/v1": {} } },
      ),
    ).toEqual([{ kind: "method_removed", location: "GET /v1" }]);
    expect(
      detectBreakingContractChanges(
        { paths: { "/v1": { get: { responses: { 200: {}, 404: {} } } } } },
        { paths: { "/v1": { get: { responses: { 200: {} } } } } },
      ),
    ).toEqual([{ kind: "response_removed", location: "GET /v1 404" }]);
  });
});

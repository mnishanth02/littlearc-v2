import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalFileAad, createFileKeyCrypto } from "./file-key.js";

const context = {
  aadSchemaVersion: 1,
  format: "application/pdf",
  householdId: "019d3157-2000-7000-8000-000000000001",
  objectId: "019d3157-2000-7000-8000-000000000002",
  purpose: "capture-original",
} as const;

describe("file key crypto", () => {
  it("wraps and unwraps a per-file key using canonical object context", () => {
    const crypto = createFileKeyCrypto({ currentKeyVersion: 1 });
    const householdKey = randomBytes(32);
    const fileKey = randomBytes(32);
    const wrapped = crypto.wrap(fileKey, householdKey, context);
    expect(crypto.unwrap(wrapped, householdKey, context)).toEqual(fileKey);
    expect(canonicalFileAad(context)).toBe(
      '{"aadSchemaVersion":1,"format":"application/pdf","householdId":"019d3157-2000-7000-8000-000000000001","objectId":"019d3157-2000-7000-8000-000000000002","purpose":"capture-original","protocol":"littlearc-file"}',
    );
  });

  it("rejects the wrong household or object context", () => {
    const crypto = createFileKeyCrypto({ currentKeyVersion: 1 });
    const householdKey = randomBytes(32);
    const wrapped = crypto.wrap(randomBytes(32), householdKey, context);
    expect(() =>
      crypto.unwrap(wrapped, householdKey, { ...context, objectId: context.householdId }),
    ).toThrow();
  });

  it("uses derivative-specific AAD without household identifiers", () => {
    const preview = canonicalFileAad({
      aadSchemaVersion: 1,
      derivativeId: "019d3157-2000-7000-8000-000000000003",
      format: "image/jpeg",
      previewPolicyVersion: 1,
      purpose: "validation-preview",
      sourceObjectId: context.objectId,
    });
    expect(preview).toBe(
      '{"aadSchemaVersion":1,"derivativeId":"019d3157-2000-7000-8000-000000000003","format":"image/jpeg","previewPolicyVersion":1,"purpose":"validation-preview","protocol":"littlearc-file","sourceObjectId":"019d3157-2000-7000-8000-000000000002"}',
    );
    expect(preview).not.toContain("householdId");
  });
});

import { describe, expect, it } from "vitest";
import {
  contractMetadata,
  contractMetadataSchema,
  createMobileApiClient,
  createStaffApiClient,
  openApiDocument,
  problemDetailsSchema,
  syncMutationSchema,
} from "./index.js";

const validUuidV7 = "019f742b-de82-7292-86cd-5475a1388313";

describe("LittleArc API contract", () => {
  it("keeps all product contract paths under /v1", () => {
    expect(Object.keys(openApiDocument.paths)).toEqual(
      expect.arrayContaining(["/v1", "/v1/openapi.json"]),
    );
    expect(Object.keys(openApiDocument.paths).every((path) => path.startsWith("/v1"))).toBe(true);
  });

  it("validates contract metadata and reserved resource prefixes", () => {
    expect(contractMetadataSchema.parse(contractMetadata)).toMatchObject({
      basePath: "/v1",
      name: "littlearc-api",
      version: "0.1.0",
    });
    expect(contractMetadata.resourceGroups.map((group) => group.prefix)).toContain("/v1/sync");
  });

  it("validates Problem Details without payload snippets", () => {
    expect(
      problemDetailsSchema.parse({
        code: "record_revision_conflict",
        detail: "Review the current confirmed values before saving again.",
        errors: [],
        instance: `/v1/records/${validUuidV7}`,
        requestId: validUuidV7,
        status: 409,
        title: "The record changed on another device",
        type: "https://littlearc.app/problems/revision-conflict",
      }),
    ).toMatchObject({
      code: "record_revision_conflict",
      status: 409,
    });
  });

  it("requires mutation identifiers and base revisions for sync envelopes", () => {
    expect(
      syncMutationSchema.parse({
        baseRevision: 1,
        entityId: validUuidV7,
        entityType: "record",
        localDependencyIds: [],
        mutationId: validUuidV7,
        operation: "update",
      }),
    ).toMatchObject({
      entityType: "record",
      operation: "update",
    });

    expect(() =>
      syncMutationSchema.parse({
        entityId: validUuidV7,
        entityType: "record",
        localDependencyIds: [],
        mutationId: validUuidV7,
        operation: "update",
      }),
    ).toThrow();
  });

  it("exports generated mobile and staff client factories", () => {
    expect(createMobileApiClient({ baseUrl: "http://127.0.0.1:3000" })).toBeDefined();
    expect(createStaffApiClient({ baseUrl: "http://127.0.0.1:3000" })).toBeDefined();
  });
});

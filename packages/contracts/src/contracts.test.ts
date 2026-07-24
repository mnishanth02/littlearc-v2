import { describe, expect, it } from "vitest";
import {
  contractMetadata,
  contractMetadataSchema,
  createMobileApiClient,
  createStaffApiClient,
  cursorSchema,
  deviceEnrollmentRequestSchema,
  deviceEnrollmentResponseSchema,
  openApiDocument,
  ownerOnboardingRequestSchema,
  problemDetailsSchema,
  recordProjectionSchema,
  recordVersionPageSchema,
  syncMutationPushRequestSchema,
  syncMutationResultSchema,
  syncMutationSchema,
  syncPullResponseSchema,
  utcTimestampSchema,
  uuidV7Schema,
} from "./index.js";

const validUuidV7 = "019f742b-de82-7292-86cd-5475a1388313";
const validTimestamp = "2026-07-24T08:00:00.000Z";

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
        entityId: validUuidV7.toUpperCase(),
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

  it.each(["\n", "\r\n"])("rejects a %j suffix in shared contract primitives", (suffix) => {
    expect(() => uuidV7Schema.parse(`${validUuidV7}${suffix}`)).toThrow();
    expect(() => utcTimestampSchema.parse(`2026-07-19T12:30:15.000Z${suffix}`)).toThrow();
    expect(() => cursorSchema.parse(`cursor_019f742b${suffix}`)).toThrow();
  });

  it("exports generated mobile and staff client factories", () => {
    expect(createMobileApiClient({ baseUrl: "http://127.0.0.1:3000" })).toBeDefined();
    expect(createStaffApiClient({ baseUrl: "http://127.0.0.1:3000" })).toBeDefined();
  });

  it("defines the bounded OFF-02 onboarding contract without verification decisions in responses", () => {
    expect(
      ownerOnboardingRequestSchema.parse({
        adultVerificationAssertion: "synthetic-approved-off-02",
        child: { dateOfBirth: "2020-01-01", preferredName: "Synthetic Child" },
        childDataConsentVersion: "child-data-processing-v1",
        countryCode: "IN",
        parent: { displayName: "Synthetic Parent", relationship: "parent" },
        parentNoticeVersion: "parent-notice-v1",
        timeZone: "Asia/Kolkata",
      }),
    ).toBeDefined();
    expect(openApiDocument.paths).toHaveProperty("/v1/households/onboarding");
    const responseSchema = openApiDocument.components?.schemas?.OwnerOnboardingResponse;
    expect(JSON.stringify(responseSchema)).not.toContain("preferredName");
    expect(JSON.stringify(responseSchema)).not.toContain("adultVerification");
  });

  it("defines authority-neutral OFF-03 device enrollment", () => {
    expect(
      deviceEnrollmentRequestSchema.parse({
        appVersion: "0.0.1",
        deviceId: validUuidV7,
        localSchemaVersion: 1,
        platform: "android",
      }),
    ).toBeDefined();
    expect(
      deviceEnrollmentResponseSchema.parse({
        deviceId: validUuidV7,
        enrollmentStatus: "active",
        householdId: validUuidV7,
        localSchemaVersion: 1,
        replayed: false,
      }),
    ).toBeDefined();
    expect(openApiDocument.paths).toHaveProperty("/v1/devices/enrollment");
    expect(JSON.stringify(openApiDocument.paths["/v1/devices/enrollment"])).not.toContain("userId");
    expect(JSON.stringify(openApiDocument.paths["/v1/devices/enrollment"])).not.toContain("role");
    expect(() =>
      deviceEnrollmentRequestSchema.parse({
        appVersion: "0.0.1\nunsafe",
        deviceId: validUuidV7,
        localSchemaVersion: 1,
        platform: "android",
      }),
    ).toThrow();
  });

  it("defines bounded OFF-04 pull, snapshot, mutation, and conflict contracts", () => {
    expect(Object.keys(openApiDocument.paths)).toEqual(
      expect.arrayContaining(["/v1/sync", "/v1/sync/snapshot", "/v1/sync/mutations"]),
    );
    expect(
      syncPullResponseSchema.parse({
        kind: "resetRequired",
        reason: "cursorExpired",
        serverTime: "2026-07-22T12:00:00.000Z",
      }),
    ).toMatchObject({ reason: "cursorExpired" });
    expect(
      syncMutationPushRequestSchema.parse({
        mutations: [
          {
            baseRevision: 1,
            entityId: validUuidV7,
            entityType: "child",
            idempotencyKey: validUuidV7,
            localDependencyIds: [],
            mutationId: validUuidV7,
            operation: "update",
            payload: { dateOfBirth: "2020-01-01", preferredName: "Synthetic Child" },
          },
        ],
      }),
    ).toBeDefined();
    expect(
      syncMutationResultSchema.parse({
        current: {
          childId: validUuidV7,
          dateOfBirth: "2020-01-01",
          preferredName: "Server Synthetic Child",
          revision: 2,
          updatedAt: "2026-07-22T12:00:00.000Z",
        },
        entityId: validUuidV7,
        mutationId: validUuidV7,
        reason: "staleCriticalRevision",
        status: "conflict",
      }),
    ).toMatchObject({ status: "conflict" });
  });

  it("defines bounded VLT-01 record, version, provenance, and mutation contracts", () => {
    const content = {
      details: {
        documentKind: { state: "confirmed", value: "Synthetic summary" },
        schema: "document.v1",
      },
      notes: { state: "notProvided" },
      providerFacility: { state: "confirmed", value: "Synthetic Clinic" },
      schemaVersion: 1,
      title: "Synthetic record",
    };
    expect(Object.keys(openApiDocument.paths)).toEqual(
      expect.arrayContaining(["/v1/records/{recordId}", "/v1/records/{recordId}/versions"]),
    );
    expect(
      recordProjectionSchema.parse({
        accessScope: "selectedHealthRecords",
        category: "document",
        childId: validUuidV7,
        confirmationState: "confirmed",
        content,
        eventAt: null,
        provenance: { sourceType: "manual", trustedIssuer: false },
        recordId: validUuidV7,
        revision: 1,
        updatedAt: "2026-07-24T12:00:00.000Z",
        version: 1,
        versionId: validUuidV7,
      }),
    ).toBeDefined();
    expect(
      recordVersionPageSchema.parse({
        items: [
          {
            confirmedAt: "2026-07-24T12:00:00.000Z",
            confirmationState: "confirmed",
            content,
            createdAt: "2026-07-24T12:00:00.000Z",
            provenance: { sourceType: "manual", trustedIssuer: false },
            recordId: validUuidV7,
            supersedesVersionId: null,
            version: 1,
            versionId: validUuidV7,
          },
        ],
        nextCursor: null,
      }),
    ).toBeDefined();
    expect(
      syncMutationPushRequestSchema.parse({
        mutations: [
          {
            baseRevision: null,
            entityId: validUuidV7,
            entityType: "record",
            idempotencyKey: validUuidV7,
            localDependencyIds: [],
            mutationId: validUuidV7,
            operation: "create",
            payload: {
              category: "document",
              childId: validUuidV7,
              content,
              eventAt: null,
              sourceType: "manual",
            },
          },
        ],
      }),
    ).toBeDefined();
    expect(() =>
      syncMutationPushRequestSchema.parse({
        mutations: [
          {
            baseRevision: null,
            entityId: validUuidV7,
            entityType: "record",
            idempotencyKey: validUuidV7,
            localDependencyIds: [],
            mutationId: validUuidV7,
            operation: "create",
            payload: {
              category: "document",
              childId: validUuidV7,
              content: { ...content, title: "x".repeat(161) },
              eventAt: null,
              sourceType: "manual",
            },
          },
        ],
      }),
    ).toThrow();
  });

  it("accepts the four bounded VLT-02 manual category payloads", () => {
    const common = {
      notes: { state: "notProvided" as const },
      providerFacility: { state: "notProvided" as const },
      schemaVersion: 1 as const,
      title: "Synthetic manual record",
    };
    const details = [
      {
        documentKind: { state: "confirmed", value: "Synthetic summary" },
        schema: "document.v1",
      },
      {
        batchLot: { state: "notProvided" },
        dateMeaning: { state: "confirmed", value: "given" },
        schema: "vaccination.v1",
        vaccineName: "Synthetic vaccine",
      },
      {
        followUpDate: { state: "confirmed", value: "2026-08-01" },
        reasonForVisit: "Synthetic visit",
        schema: "doctor_visit.v1",
        tags: { state: "confirmed", value: "routine" },
      },
      {
        duration: { state: "notProvided" },
        endDate: { state: "confirmed", value: "2026-08-02" },
        medicines: "Synthetic medicine",
        schema: "prescription.v1",
        writtenSchedule: { state: "confirmed", value: "Literal written schedule" },
      },
    ] as const;

    for (const categoryDetails of details) {
      expect(() =>
        recordProjectionSchema.parse({
          accessScope: "selectedHealthRecords",
          category:
            categoryDetails.schema === "document.v1"
              ? "document"
              : categoryDetails.schema === "vaccination.v1"
                ? "vaccination"
                : categoryDetails.schema === "doctor_visit.v1"
                  ? "doctor_visit"
                  : "prescription",
          childId: validUuidV7,
          confirmationState: "confirmed",
          content: { ...common, details: categoryDetails },
          eventAt: null,
          provenance: { sourceType: "manual", trustedIssuer: false },
          recordId: validUuidV7,
          revision: 1,
          updatedAt: validTimestamp,
          version: 1,
          versionId: validUuidV7,
        }),
      ).not.toThrow();
    }
  });
});

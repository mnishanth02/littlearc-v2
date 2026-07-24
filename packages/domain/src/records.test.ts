import { describe, expect, it } from "vitest";
import {
  assertConsumerRecordSource,
  assertRecordTransition,
  assertRecordVersionContent,
  canArchiveOrDeleteRecord,
  canCorrectRecord,
  canCreateRecord,
  canReadRecord,
  type RecordVersionContentV1,
  recordAccessScopeForCategory,
  timelineEventForConfirmedRecord,
} from "./records.js";

const content: RecordVersionContentV1 = {
  details: {
    documentKind: { state: "confirmed", value: "Synthetic discharge summary" },
    schema: "document.v1",
  },
  notes: { state: "confirmed", value: "Synthetic note for validation only" },
  providerFacility: { state: "confirmed", value: "Synthetic Clinic" },
  schemaVersion: 1,
  title: "Synthetic record",
};

describe("VLT-01 record policy", () => {
  it("validates the bounded version payload", () => {
    expect(() => assertRecordVersionContent(content)).not.toThrow();
    expect(() =>
      assertRecordVersionContent({
        ...content,
        title: ` ${content.title}`,
      }),
    ).toThrow("title must be trimmed");
    expect(() =>
      assertRecordVersionContent({
        ...content,
        notes: { state: "confirmed", value: "x".repeat(2_001) },
      }),
    ).toThrow("notes");
  });

  it("derives access scope without accepting a client ACL", () => {
    expect(recordAccessScopeForCategory("identity")).toBe("identityDocuments");
    expect(recordAccessScopeForCategory("document")).toBe("selectedHealthRecords");
  });

  it("requires precise caregiver capabilities", () => {
    expect(canReadRecord({ role: "owner" }, "identityDocuments")).toBe(true);
    expect(canCreateRecord({ role: "owner" })).toBe(true);
    expect(canArchiveOrDeleteRecord({ role: "owner" })).toBe(true);

    const caregiver = {
      grantedCapabilities: new Set([
        "viewSelectedHealthRecords",
        "addRecords",
        "editConfirmedRecords",
      ] as const),
      role: "caregiver" as const,
    };
    expect(canReadRecord(caregiver, "selectedHealthRecords")).toBe(true);
    expect(canReadRecord(caregiver, "identityDocuments")).toBe(false);
    expect(canCreateRecord(caregiver)).toBe(true);
    expect(canCorrectRecord(caregiver, "selectedHealthRecords")).toBe(true);
    expect(canArchiveOrDeleteRecord(caregiver)).toBe(false);
  });

  it("keeps trusted issuer provenance behind a future adapter", () => {
    expect(() => assertConsumerRecordSource("manual")).not.toThrow();
    expect(() => assertConsumerRecordSource("provider_issued")).toThrow("approved issuer adapter");
    expect(() => assertConsumerRecordSource("government_imported")).toThrow(
      "approved issuer adapter",
    );
  });

  it("allows only reviewed lifecycle transitions", () => {
    expect(assertRecordTransition(null, "createDraft")).toBe("draft");
    expect(assertRecordTransition(null, "createConfirmed")).toBe("confirmed");
    expect(assertRecordTransition("confirmed", "correct")).toBe("confirmed");
    expect(assertRecordTransition("confirmed", "archive")).toBe("archived");
    expect(assertRecordTransition("draft", "delete")).toBe("draft");
    expect(() => assertRecordTransition("draft", "correct")).toThrow("draft -> correct");
  });

  it("labels confirmation-time fallback without inventing a clinical date", () => {
    expect(
      timelineEventForConfirmedRecord({
        category: "document",
        confirmedAt: "2026-07-24T08:00:00.000Z",
        content,
        eventAt: null,
      }),
    ).toEqual({
      content: {
        category: "document",
        dateAuthority: "confirmedAtFallback",
        title: "Synthetic record",
      },
      eventAt: "2026-07-24T08:00:00.000Z",
    });

    expect(
      timelineEventForConfirmedRecord({
        category: "document",
        confirmedAt: "2026-07-24T08:00:00.000Z",
        content,
        eventAt: "2026-06-20T00:00:00.000Z",
      }).content.dateAuthority,
    ).toBe("recordEventAt");
  });
});

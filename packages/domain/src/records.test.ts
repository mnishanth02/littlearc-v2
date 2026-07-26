import { describe, expect, it } from "vitest";
import {
  assertConsumerRecordSource,
  assertRecordContentForCategory,
  assertRecordTransition,
  assertRecordVersionContent,
  assertVaccinationDateMeaning,
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

  it("validates all VLT-02 category payloads and category agreement", () => {
    const vaccination: RecordVersionContentV1 = {
      ...content,
      details: {
        batchLot: { state: "confirmed", value: "SYNTHETIC-LOT" },
        dateMeaning: { state: "confirmed", value: "given" },
        schema: "vaccination.v1",
        vaccineName: "Synthetic vaccine",
      },
    };
    const visit: RecordVersionContentV1 = {
      ...content,
      details: {
        followUpDate: { state: "confirmed", value: "2026-08-01" },
        reasonForVisit: "Synthetic follow-up",
        schema: "doctor_visit.v1",
        tags: { state: "confirmed", value: "routine" },
      },
    };
    const prescription: RecordVersionContentV1 = {
      ...content,
      details: {
        duration: { state: "confirmed", value: "Synthetic duration" },
        endDate: { state: "confirmed", value: "2026-08-02" },
        medicines: "Synthetic medicine",
        schema: "prescription.v1",
        writtenSchedule: { state: "confirmed", value: "Literal source text only" },
      },
    };

    expect(() => assertRecordContentForCategory("document", content)).not.toThrow();
    expect(() => assertRecordContentForCategory("vaccination", vaccination)).not.toThrow();
    expect(() => assertRecordContentForCategory("doctor_visit", visit)).not.toThrow();
    expect(() => assertRecordContentForCategory("prescription", prescription)).not.toThrow();
    expect(() => assertRecordContentForCategory("document", vaccination)).toThrow(
      "category does not match",
    );
    expect(() =>
      assertRecordVersionContent({
        ...visit,
        details: {
          followUpDate: { state: "confirmed", value: "2026-02-30" },
          reasonForVisit: "Synthetic follow-up",
          schema: "doctor_visit.v1",
          tags: { state: "confirmed", value: "routine" },
        },
      }),
    ).toThrow("valid calendar date");
  });

  it("requires explicit meaning for a vaccination date", () => {
    const details = {
      batchLot: { state: "notProvided" },
      dateMeaning: { state: "notProvided" },
      schema: "vaccination.v1",
      vaccineName: "Synthetic vaccine",
    } as const;
    expect(() => assertVaccinationDateMeaning({ details, eventAt: null })).not.toThrow();
    expect(() =>
      assertVaccinationDateMeaning({
        details,
        eventAt: "2026-07-24T00:00:00.000Z",
      }),
    ).toThrow("due or given");
    expect(() =>
      assertVaccinationDateMeaning({
        details: { ...details, dateMeaning: { state: "confirmed", value: "due" } },
        eventAt: null,
      }),
    ).toThrow("Enter a vaccination date");
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

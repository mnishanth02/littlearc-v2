import { describe, expect, it } from "vitest";
import type { LocalRecordProjection } from "../sync/repository";
import {
  buildConfirmedManualRecord,
  emptyManualRecordForm,
  manualRecordFormFromProjection,
  parseManualRecordDraft,
} from "./form";

describe("VLT-02 manual record form", () => {
  it.each([
    ["document", { documentKind: "Discharge summary", title: "Synthetic document" }, "document.v1"],
    [
      "vaccination",
      {
        eventDate: "2026-07-20",
        title: "Synthetic vaccination",
        vaccinationDateMeaning: "given",
        vaccineName: "Synthetic vaccine",
      },
      "vaccination.v1",
    ],
    [
      "doctor_visit",
      {
        followUpDate: "2026-08-01",
        reasonForVisit: "Synthetic visit",
        title: "Synthetic visit",
      },
      "doctor_visit.v1",
    ],
    [
      "prescription",
      { medicines: "Synthetic medicine", title: "Synthetic prescription" },
      "prescription.v1",
    ],
  ] as const)("builds a bounded %s payload", (category, values, schema) => {
    const result = buildConfirmedManualRecord({
      ...emptyManualRecordForm(category),
      ...values,
    });
    expect(result.content.details.schema).toBe(schema);
    expect(result.content.title).toContain("Synthetic");
  });

  it("blocks ambiguous vaccination dates and invalid follow-up dates", () => {
    expect(() =>
      buildConfirmedManualRecord({
        ...emptyManualRecordForm("vaccination"),
        eventDate: "2026-07-20",
        title: "Synthetic vaccination",
        vaccineName: "Synthetic vaccine",
      }),
    ).toThrow("due or given");
    expect(() =>
      buildConfirmedManualRecord({
        ...emptyManualRecordForm("doctor_visit"),
        followUpDate: "2026-02-30",
        reasonForVisit: "Synthetic visit",
        title: "Synthetic visit",
      }),
    ).toThrow("valid calendar date");
  });

  it("restores only bounded string fields from a local draft", () => {
    expect(
      parseManualRecordDraft(
        JSON.stringify({
          category: "prescription",
          medicines: "Synthetic medicine",
          nested: { unsafe: true },
          title: "Synthetic draft",
          vaccinationDateMeaning: "invalid",
        }),
        "prescription",
      ),
    ).toMatchObject({
      category: "prescription",
      medicines: "Synthetic medicine",
      title: "Synthetic draft",
      vaccinationDateMeaning: "",
    });
  });

  it("maps a current immutable projection back into a correction form", () => {
    const record: LocalRecordProjection = {
      accessScope: "selectedHealthRecords",
      category: "prescription",
      childId: "019f742b-de82-7292-86cd-5475a1388313",
      confirmationState: "confirmed",
      content: {
        details: {
          duration: { state: "notProvided" },
          endDate: { state: "confirmed", value: "2026-08-02" },
          medicines: "Synthetic medicine",
          schema: "prescription.v1",
          writtenSchedule: { state: "confirmed", value: "Literal instructions" },
        },
        notes: { state: "notProvided" },
        providerFacility: { state: "confirmed", value: "Synthetic Clinic" },
        schemaVersion: 1,
        title: "Synthetic prescription",
      },
      deletedAt: null,
      eventAt: "2026-07-20T00:00:00.000Z",
      provenance: { sourceType: "manual", trustedIssuer: false },
      recordId: "019f742b-de82-7292-86cd-5475a1388314",
      revision: 2,
      syncStatus: "synced",
      updatedAt: "2026-07-24T08:00:00.000Z",
      version: 2,
      versionId: "019f742b-de82-7292-86cd-5475a1388315",
    };

    expect(manualRecordFormFromProjection(record)).toMatchObject({
      endDate: "2026-08-02",
      eventDate: "2026-07-20",
      medicines: "Synthetic medicine",
      providerFacility: "Synthetic Clinic",
      writtenSchedule: "Literal instructions",
    });
  });
});

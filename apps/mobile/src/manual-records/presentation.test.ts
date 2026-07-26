import { describe, expect, it } from "vitest";
import type { LocalRecordProjection } from "../sync/repository";
import { recordDateLabel, recordFieldRows, recordStatusLabel } from "./presentation";

const record: LocalRecordProjection = {
  accessScope: "selectedHealthRecords",
  category: "vaccination",
  childId: "019f742b-de82-7292-86cd-5475a1388313",
  confirmationState: "confirmed",
  content: {
    details: {
      batchLot: { state: "notProvided" },
      dateMeaning: { state: "confirmed", value: "given" },
      schema: "vaccination.v1",
      vaccineName: "Synthetic vaccine",
    },
    notes: { state: "notProvided" },
    providerFacility: { state: "confirmed", value: "Synthetic Clinic" },
    schemaVersion: 1,
    title: "Synthetic vaccination",
  },
  deletedAt: null,
  eventAt: "2026-07-20T00:00:00.000Z",
  provenance: { sourceType: "manual", trustedIssuer: false },
  recordId: "019f742b-de82-7292-86cd-5475a1388314",
  revision: 1,
  syncStatus: "pending",
  updatedAt: "2026-07-24T08:00:00.000Z",
  version: 1,
  versionId: "019f742b-de82-7292-86cd-5475a1388315",
};

describe("VLT-02 record presentation", () => {
  it("uses textual status, date meaning, and explicit optional states", () => {
    expect(recordStatusLabel(record)).toBe("Saved on this device; waiting to sync");
    expect(recordDateLabel(record)).toBe("Record date: 2026-07-20");
    expect(recordFieldRows(record)).toEqual(
      expect.arrayContaining([
        { label: "Entered date means", value: "Given" },
        { label: "Batch or lot", value: "Not provided" },
      ]),
    );
  });
});

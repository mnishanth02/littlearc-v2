import type { OptionalConfirmedDate, OptionalConfirmedText } from "@littlearc/domain";
import type { LocalRecordProjection, RecordVersionProjection } from "../sync/repository";
import { isManualRecordCategory, manualRecordCategoryLabel } from "./form";

export type RecordFieldRow = {
  readonly label: string;
  readonly value: string;
};

export function recordStatusLabel(record: LocalRecordProjection): string {
  if (record.deletedAt) {
    return "Deleted on this device; waiting for synchronization";
  }
  if (record.syncStatus === "pending") {
    return "Saved on this device; waiting to sync";
  }
  if (record.syncStatus === "conflict") {
    return "Needs review because this record changed elsewhere";
  }
  if (record.syncStatus === "rejected") {
    return "Not accepted by the server; your local copy is preserved";
  }
  return "Synced";
}

export function recordDateLabel(record: LocalRecordProjection): string {
  return record.eventAt
    ? `Record date: ${record.eventAt.slice(0, 10)}`
    : `No clinical date provided; ordered by confirmation time`;
}

export function recordFieldRows(record: LocalRecordProjection): ReadonlyArray<RecordFieldRow> {
  const rows: RecordFieldRow[] = [
    {
      label: "Category",
      value: isManualRecordCategory(record.category)
        ? manualRecordCategoryLabel(record.category)
        : record.category,
    },
    { label: "Title", value: record.content.title },
    { label: "Provider or facility", value: optionalTextLabel(record.content.providerFacility) },
    { label: "Notes", value: optionalTextLabel(record.content.notes) },
  ];
  switch (record.content.details.schema) {
    case "document.v1":
      rows.push({
        label: "Document kind",
        value: optionalTextLabel(record.content.details.documentKind),
      });
      break;
    case "vaccination.v1":
      rows.push(
        { label: "Vaccine name", value: record.content.details.vaccineName },
        {
          label: "Entered date means",
          value:
            record.content.details.dateMeaning.state === "confirmed"
              ? record.content.details.dateMeaning.value === "given"
                ? "Given"
                : "Due"
              : "Not provided",
        },
        { label: "Batch or lot", value: optionalTextLabel(record.content.details.batchLot) },
      );
      break;
    case "doctor_visit.v1":
      rows.push(
        { label: "Reason for visit", value: record.content.details.reasonForVisit },
        {
          label: "Follow-up date",
          value: optionalDateLabel(record.content.details.followUpDate),
        },
        { label: "Tags", value: optionalTextLabel(record.content.details.tags) },
      );
      break;
    case "prescription.v1":
      rows.push(
        { label: "Medicines", value: record.content.details.medicines },
        {
          label: "Written schedule",
          value: optionalTextLabel(record.content.details.writtenSchedule),
        },
        { label: "Duration", value: optionalTextLabel(record.content.details.duration) },
        { label: "End date", value: optionalDateLabel(record.content.details.endDate) },
      );
      break;
  }
  return rows;
}

export function versionSummary(version: RecordVersionProjection): string {
  const state = version.confirmationState === "confirmed" ? "Confirmed" : version.confirmationState;
  return `Version ${version.version} · ${state} · ${version.createdAt.slice(0, 10)}`;
}

function optionalTextLabel(value: OptionalConfirmedText): string {
  return value.state === "confirmed" ? value.value : "Not provided";
}

function optionalDateLabel(value: OptionalConfirmedDate): string {
  return value.state === "confirmed" ? value.value : "Not provided";
}

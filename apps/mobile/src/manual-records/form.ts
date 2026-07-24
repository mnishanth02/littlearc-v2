import {
  assertRecordContentForCategory,
  assertVaccinationDateMeaning,
  type OptionalConfirmedDate,
  type OptionalConfirmedText,
  type RecordCategory,
  type RecordVersionContentV1,
} from "@littlearc/domain";
import type { LocalRecordProjection } from "../sync/repository";

export type ManualRecordCategory = Extract<
  RecordCategory,
  "document" | "vaccination" | "doctor_visit" | "prescription"
>;

export type ManualRecordFormValues = {
  readonly batchLot: string;
  readonly category: ManualRecordCategory;
  readonly documentKind: string;
  readonly duration: string;
  readonly endDate: string;
  readonly eventDate: string;
  readonly followUpDate: string;
  readonly medicines: string;
  readonly notes: string;
  readonly providerFacility: string;
  readonly reasonForVisit: string;
  readonly tags: string;
  readonly title: string;
  readonly vaccinationDateMeaning: "" | "due" | "given";
  readonly vaccineName: string;
  readonly writtenSchedule: string;
};

export type ConfirmedManualRecord = {
  readonly category: ManualRecordCategory;
  readonly content: RecordVersionContentV1;
  readonly eventAt: string | null;
};

export const manualRecordCategories: ReadonlyArray<ManualRecordCategory> = [
  "document",
  "vaccination",
  "doctor_visit",
  "prescription",
];

export function emptyManualRecordForm(
  category: ManualRecordCategory = "document",
): ManualRecordFormValues {
  return {
    batchLot: "",
    category,
    documentKind: "",
    duration: "",
    endDate: "",
    eventDate: "",
    followUpDate: "",
    medicines: "",
    notes: "",
    providerFacility: "",
    reasonForVisit: "",
    tags: "",
    title: "",
    vaccinationDateMeaning: "",
    vaccineName: "",
    writtenSchedule: "",
  };
}

export function parseManualRecordDraft(
  value: string,
  category: ManualRecordCategory,
): ManualRecordFormValues {
  const parsed = JSON.parse(value) as Partial<ManualRecordFormValues>;
  const empty = emptyManualRecordForm(category);
  return {
    ...empty,
    ...Object.fromEntries(
      Object.entries(parsed).filter(([, fieldValue]) => typeof fieldValue === "string"),
    ),
    category,
    vaccinationDateMeaning:
      parsed.vaccinationDateMeaning === "due" || parsed.vaccinationDateMeaning === "given"
        ? parsed.vaccinationDateMeaning
        : "",
  };
}

export function buildConfirmedManualRecord(form: ManualRecordFormValues): ConfirmedManualRecord {
  const common = {
    notes: optionalText(form.notes),
    providerFacility: optionalText(form.providerFacility),
    schemaVersion: 1 as const,
    title: form.title.trim(),
  };
  const content: RecordVersionContentV1 =
    form.category === "document"
      ? {
          ...common,
          details: {
            documentKind: optionalText(form.documentKind),
            schema: "document.v1",
          },
        }
      : form.category === "vaccination"
        ? {
            ...common,
            details: {
              batchLot: optionalText(form.batchLot),
              dateMeaning:
                form.vaccinationDateMeaning === ""
                  ? { state: "notProvided" }
                  : { state: "confirmed", value: form.vaccinationDateMeaning },
              schema: "vaccination.v1",
              vaccineName: form.vaccineName.trim(),
            },
          }
        : form.category === "doctor_visit"
          ? {
              ...common,
              details: {
                followUpDate: optionalDate(form.followUpDate),
                reasonForVisit: form.reasonForVisit.trim(),
                schema: "doctor_visit.v1",
                tags: optionalText(form.tags),
              },
            }
          : {
              ...common,
              details: {
                duration: optionalText(form.duration),
                endDate: optionalDate(form.endDate),
                medicines: form.medicines.trim(),
                schema: "prescription.v1",
                writtenSchedule: optionalText(form.writtenSchedule),
              },
            };
  const eventDate = form.eventDate.trim();
  if (eventDate) {
    assertCalendarDate(eventDate, "event or document date");
  }
  const eventAt = eventDate ? `${eventDate}T00:00:00.000Z` : null;
  assertRecordContentForCategory(form.category, content);
  if (content.details.schema === "vaccination.v1") {
    assertVaccinationDateMeaning({ details: content.details, eventAt });
  }
  return { category: form.category, content, eventAt };
}

export function manualRecordFormFromProjection(
  record: LocalRecordProjection,
): ManualRecordFormValues {
  if (!isManualRecordCategory(record.category)) {
    throw new Error("This record category is not editable in VLT-02.");
  }
  const form = {
    ...emptyManualRecordForm(record.category),
    eventDate: record.eventAt?.slice(0, 10) ?? "",
    notes: optionalTextValue(record.content.notes),
    providerFacility: optionalTextValue(record.content.providerFacility),
    title: record.content.title,
  };
  switch (record.content.details.schema) {
    case "document.v1":
      return {
        ...form,
        documentKind: optionalTextValue(record.content.details.documentKind),
      };
    case "vaccination.v1":
      return {
        ...form,
        batchLot: optionalTextValue(record.content.details.batchLot),
        vaccinationDateMeaning:
          record.content.details.dateMeaning.state === "confirmed"
            ? record.content.details.dateMeaning.value
            : "",
        vaccineName: record.content.details.vaccineName,
      };
    case "doctor_visit.v1":
      return {
        ...form,
        followUpDate: optionalDateValue(record.content.details.followUpDate),
        reasonForVisit: record.content.details.reasonForVisit,
        tags: optionalTextValue(record.content.details.tags),
      };
    case "prescription.v1":
      return {
        ...form,
        duration: optionalTextValue(record.content.details.duration),
        endDate: optionalDateValue(record.content.details.endDate),
        medicines: record.content.details.medicines,
        writtenSchedule: optionalTextValue(record.content.details.writtenSchedule),
      };
  }
}

export function manualRecordCategoryLabel(category: ManualRecordCategory): string {
  if (category === "doctor_visit") {
    return "Doctor visit";
  }
  return category[0]?.toUpperCase() + category.slice(1);
}

export function isManualRecordCategory(category: RecordCategory): category is ManualRecordCategory {
  return manualRecordCategories.includes(category as ManualRecordCategory);
}

function optionalText(value: string): OptionalConfirmedText {
  const trimmed = value.trim();
  return trimmed ? { state: "confirmed", value: trimmed } : { state: "notProvided" };
}

function optionalDate(value: string): OptionalConfirmedDate {
  const trimmed = value.trim();
  return trimmed ? { state: "confirmed", value: trimmed } : { state: "notProvided" };
}

function optionalTextValue(value: OptionalConfirmedText): string {
  return value.state === "confirmed" ? value.value : "";
}

function optionalDateValue(value: OptionalConfirmedDate): string {
  return value.state === "confirmed" ? value.value : "";
}

function assertCalendarDate(value: string, label: string): void {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Enter a valid ${label}.`);
  }
}

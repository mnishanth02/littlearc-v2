import type {
  ConfirmationState,
  HouseholdCapability,
  HouseholdRole,
  RecordCategory,
  RecordSourceType,
} from "./policies.js";
import type { UtcTimestamp } from "./primitives.js";

export const recordAccessScopes = ["selectedHealthRecords", "identityDocuments"] as const;
export type RecordAccessScope = (typeof recordAccessScopes)[number];

export const recordVersionPayloadSchemaVersions = [1] as const;
export type RecordVersionPayloadSchemaVersion = (typeof recordVersionPayloadSchemaVersions)[number];

export type OptionalConfirmedText =
  | { readonly state: "notProvided" }
  | { readonly state: "confirmed"; readonly value: string };

export type DocumentRecordDetailsV1 = {
  readonly schema: "document.v1";
  readonly documentKind: OptionalConfirmedText;
};

export type RecordVersionContentV1 = {
  readonly schemaVersion: 1;
  readonly title: string;
  readonly providerFacility: OptionalConfirmedText;
  readonly notes: OptionalConfirmedText;
  readonly details: DocumentRecordDetailsV1;
};

export type RecordTimelineDateAuthority = "recordEventAt" | "confirmedAtFallback";

export type GeneratedRecordTimelineContent = {
  readonly dateAuthority: RecordTimelineDateAuthority;
  readonly title: string;
  readonly category: RecordCategory;
};

export type RecordAuthorizationInput = {
  readonly role: HouseholdRole;
  readonly grantedCapabilities?: ReadonlySet<HouseholdCapability>;
};

export class RecordPolicyError extends Error {
  readonly code:
    | "access_denied"
    | "content_invalid"
    | "provenance_not_authorized"
    | "transition_invalid";

  constructor(code: RecordPolicyError["code"], message: string) {
    super(message);
    this.name = "RecordPolicyError";
    this.code = code;
  }
}

export function recordAccessScopeForCategory(category: RecordCategory): RecordAccessScope {
  return category === "identity" ? "identityDocuments" : "selectedHealthRecords";
}

export function canReadRecord(
  input: RecordAuthorizationInput,
  accessScope: RecordAccessScope,
): boolean {
  if (input.role === "owner") {
    return true;
  }

  const capability =
    accessScope === "identityDocuments" ? "viewIdentityDocuments" : "viewSelectedHealthRecords";
  return input.grantedCapabilities?.has(capability) === true;
}

export function canCreateRecord(input: RecordAuthorizationInput): boolean {
  return input.role === "owner" || input.grantedCapabilities?.has("addRecords") === true;
}

export function canCorrectRecord(
  input: RecordAuthorizationInput,
  accessScope: RecordAccessScope,
): boolean {
  return (
    canReadRecord(input, accessScope) &&
    (input.role === "owner" || input.grantedCapabilities?.has("editConfirmedRecords") === true)
  );
}

export function canArchiveOrDeleteRecord(input: RecordAuthorizationInput): boolean {
  return input.role === "owner";
}

export function assertConsumerRecordSource(
  sourceType: RecordSourceType,
): asserts sourceType is "manual" | "imported" | "ocr_assisted" | "ai_assisted" {
  if (sourceType === "provider_issued" || sourceType === "government_imported") {
    throw new RecordPolicyError(
      "provenance_not_authorized",
      "Trusted provider or government provenance requires an approved issuer adapter.",
    );
  }
}

export function assertRecordVersionContent(content: RecordVersionContentV1): void {
  if (content.schemaVersion !== 1 || content.details.schema !== "document.v1") {
    invalid("The record payload schema is not supported.");
  }
  assertText(content.title, "title", 160);
  assertOptionalText(content.providerFacility, "provider or facility", 160);
  assertOptionalText(content.notes, "notes", 2_000);
  assertOptionalText(content.details.documentKind, "document kind", 120);

  const encodedLength = new TextEncoder().encode(JSON.stringify(content)).byteLength;
  if (encodedLength > 16_384) {
    invalid("The record payload exceeds the 16 KiB VLT-01 limit.");
  }
}

export function assertRecordTransition(
  current: ConfirmationState | null,
  action: "createDraft" | "createConfirmed" | "correct" | "archive" | "delete",
): ConfirmationState {
  if (current === null && action === "createDraft") {
    return "draft";
  }
  if (current === null && action === "createConfirmed") {
    return "confirmed";
  }
  if (current === "confirmed" && action === "correct") {
    return "confirmed";
  }
  if (current === "confirmed" && action === "archive") {
    return "archived";
  }
  if (current !== null && action === "delete") {
    return current;
  }

  throw new RecordPolicyError(
    "transition_invalid",
    `Record transition ${current ?? "new"} -> ${action} is not allowed.`,
  );
}

export function timelineEventForConfirmedRecord(input: {
  readonly category: RecordCategory;
  readonly confirmedAt: UtcTimestamp | string;
  readonly content: RecordVersionContentV1;
  readonly eventAt: UtcTimestamp | string | null;
}): {
  readonly content: GeneratedRecordTimelineContent;
  readonly eventAt: string;
} {
  assertRecordVersionContent(input.content);
  if (input.eventAt !== null) {
    assertUtcTimestamp(input.eventAt, "eventAt");
  }
  assertUtcTimestamp(input.confirmedAt, "confirmedAt");

  return {
    content: {
      category: input.category,
      dateAuthority: input.eventAt === null ? "confirmedAtFallback" : "recordEventAt",
      title: input.content.title,
    },
    eventAt: input.eventAt ?? input.confirmedAt,
  };
}

function assertOptionalText(value: OptionalConfirmedText, label: string, maximum: number): void {
  if (value.state === "confirmed") {
    assertText(value.value, label, maximum);
  }
}

function assertText(value: string, label: string, maximum: number): void {
  if (value !== value.trim() || value.length < 1 || value.length > maximum) {
    invalid(`${label} must be trimmed and contain between one and ${maximum} characters.`);
  }
}

function assertUtcTimestamp(value: string, label: string): void {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value || !value.endsWith("Z")) {
    invalid(`${label} must be a normalized UTC timestamp.`);
  }
}

function invalid(message: string): never {
  throw new RecordPolicyError("content_invalid", message);
}

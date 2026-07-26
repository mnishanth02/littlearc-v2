import type { HouseholdCapability, HouseholdRole } from "./policies.js";

export const emergencyCardAccessModes = ["standard"] as const;
export type EmergencyCardAccessMode = (typeof emergencyCardAccessModes)[number];

export type ConfirmedScalar =
  | { readonly state: "notProvided" }
  | { readonly state: "confirmed"; readonly value: string };

export type ConfirmedList =
  | { readonly state: "notProvided" }
  | { readonly state: "noneConfirmed" }
  | { readonly state: "confirmed"; readonly values: ReadonlyArray<string> };

export type EmergencyContact = {
  readonly name: string;
  readonly phone: string;
  readonly relationship: string;
};

export type PediatricianContact =
  | { readonly state: "notProvided" }
  | {
      readonly state: "confirmed";
      readonly name: string;
      readonly phone: string;
    };

export type EmergencyCardContent = {
  readonly preferredName: string;
  readonly dateOfBirth: string;
  readonly bloodGroup: ConfirmedScalar;
  readonly allergies: ConfirmedList;
  readonly criticalNotes: ConfirmedList;
  readonly urgentMedications: ConfirmedList;
  readonly guardianContacts: ReadonlyArray<EmergencyContact>;
  readonly pediatrician: PediatricianContact;
};

export class EmergencyCardPolicyError extends Error {
  readonly code: "access_denied" | "content_invalid" | "quick_access_not_approved";

  constructor(code: EmergencyCardPolicyError["code"], message: string) {
    super(message);
    this.name = "EmergencyCardPolicyError";
    this.code = code;
  }
}

export function canReadEmergencyCard(input: {
  readonly role: HouseholdRole;
  readonly grantedCapabilities?: ReadonlySet<HouseholdCapability>;
}): boolean {
  return input.role === "owner" || input.grantedCapabilities?.has("viewEmergencyCard") === true;
}

export function canEditEmergencyCard(input: {
  readonly role: HouseholdRole;
  readonly grantedCapabilities?: ReadonlySet<HouseholdCapability>;
}): boolean {
  return (
    input.role === "owner" ||
    (input.grantedCapabilities?.has("viewEmergencyCard") === true &&
      input.grantedCapabilities.has("editConfirmedRecords"))
  );
}

export function assertStandardEmergencyCardAccess(mode: string): asserts mode is "standard" {
  if (mode !== "standard") {
    throw new EmergencyCardPolicyError(
      "quick_access_not_approved",
      "Locked quick emergency access is not approved for this release.",
    );
  }
}

export function assertEmergencyCardContent(content: EmergencyCardContent): void {
  assertText(content.preferredName, "preferred name", 120);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(content.dateOfBirth)) {
    invalid("Date of birth must be a calendar date.");
  }
  const birthDate = new Date(`${content.dateOfBirth}T00:00:00.000Z`);
  if (
    Number.isNaN(birthDate.getTime()) ||
    birthDate.toISOString().slice(0, 10) !== content.dateOfBirth
  ) {
    invalid("Date of birth must be a valid calendar date.");
  }
  assertScalar(content.bloodGroup, "blood group", 16);
  assertList(content.allergies, "allergies", 20, 160);
  assertList(content.criticalNotes, "critical notes", 20, 500);
  assertList(content.urgentMedications, "urgent medications", 20, 160);
  if (content.guardianContacts.length < 1 || content.guardianContacts.length > 5) {
    invalid("At least one and at most five guardian contacts are required.");
  }
  for (const contact of content.guardianContacts) {
    assertText(contact.name, "guardian name", 120);
    assertText(contact.relationship, "guardian relationship", 80);
    assertPhone(contact.phone);
  }
  if (content.pediatrician.state === "confirmed") {
    assertText(content.pediatrician.name, "pediatrician name", 120);
    assertPhone(content.pediatrician.phone);
  }
}

export function ageInYears(dateOfBirth: string, today = new Date()): number {
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new EmergencyCardPolicyError("content_invalid", "Date of birth is invalid.");
  }
  let age = today.getUTCFullYear() - year;
  const beforeBirthday =
    today.getUTCMonth() + 1 < month ||
    (today.getUTCMonth() + 1 === month && today.getUTCDate() < day);
  if (beforeBirthday) {
    age -= 1;
  }
  return Math.max(0, age);
}

export function dialerUrl(phone: string): string {
  assertPhone(phone);
  return `tel:${phone}`;
}

function assertScalar(value: ConfirmedScalar, label: string, maximum: number): void {
  if (value.state === "confirmed") {
    assertText(value.value, label, maximum);
  }
}

function assertList(
  value: ConfirmedList,
  label: string,
  maximumItems: number,
  maximumItemLength: number,
): void {
  if (value.state !== "confirmed") {
    return;
  }
  if (value.values.length < 1 || value.values.length > maximumItems) {
    invalid(`Confirmed ${label} must include between one and ${maximumItems} values.`);
  }
  for (const item of value.values) {
    assertText(item, label, maximumItemLength);
  }
}

function assertText(value: string, label: string, maximum: number): void {
  if (value.trim().length < 1 || value.length > maximum || value !== value.trim()) {
    invalid(`${label} must be trimmed and contain between one and ${maximum} characters.`);
  }
}

function assertPhone(phone: string): void {
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    invalid("Phone numbers must use E.164 format.");
  }
}

function invalid(message: string): never {
  throw new EmergencyCardPolicyError("content_invalid", message);
}

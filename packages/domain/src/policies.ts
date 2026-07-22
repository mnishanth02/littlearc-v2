export const householdRoles = ["owner", "caregiver"] as const;
export type HouseholdRole = (typeof householdRoles)[number];

export const householdCapabilities = [
  "viewEmergencyCard",
  "viewSelectedHealthRecords",
  "viewIdentityDocuments",
  "addRecords",
  "editConfirmedRecords",
  "manageTasks",
  "inviteMembers",
  "exportHousehold",
  "deleteHousehold",
  "manageEntitlement",
  "viewWorkflowStatus",
] as const;
export type HouseholdCapability = (typeof householdCapabilities)[number];

export const caregiverGrantableCapabilities = [
  "viewEmergencyCard",
  "viewSelectedHealthRecords",
  "viewIdentityDocuments",
  "addRecords",
  "editConfirmedRecords",
  "manageTasks",
] as const satisfies ReadonlyArray<HouseholdCapability>;

const ownerCapabilities = new Set<HouseholdCapability>([
  "viewEmergencyCard",
  "viewSelectedHealthRecords",
  "viewIdentityDocuments",
  "addRecords",
  "editConfirmedRecords",
  "manageTasks",
  "inviteMembers",
  "exportHousehold",
  "deleteHousehold",
  "manageEntitlement",
]);

export const staffCapabilities = ["manageEntitlement", "viewWorkflowStatus"] as const;
export type StaffCapability = (typeof staffCapabilities)[number];

export type HouseholdAuthorizationInput = {
  readonly role: HouseholdRole;
  readonly capability: HouseholdCapability;
  readonly grantedCapabilities?: ReadonlySet<HouseholdCapability>;
};

export function canPerformHouseholdCapability(input: HouseholdAuthorizationInput): boolean {
  if (input.role === "owner") {
    return ownerCapabilities.has(input.capability);
  }

  return input.grantedCapabilities?.has(input.capability) ?? false;
}

export function canPerformStaffCapability(
  capability: StaffCapability,
  purposeCodeRecorded: boolean,
): boolean {
  return capability === "viewWorkflowStatus" || purposeCodeRecorded;
}

export const consentPurposes = [
  "parent_notice",
  "child_data_processing",
  "third_party_vision_processing",
  "cloud_ai_extraction",
] as const;
export type ConsentPurpose = (typeof consentPurposes)[number];

export const consentStates = ["granted", "withdrawn"] as const;
export type ConsentState = (typeof consentStates)[number];

export const auditActions = [
  "household_created",
  "child_created",
  "child_updated",
  "consent_recorded",
  "record_created",
  "record_updated",
  "record_deleted",
  "membership_changed",
  "device_enrolled",
  "staff_action_recorded",
] as const;
export type AuditAction = (typeof auditActions)[number];

export const recordCategories = [
  "emergency",
  "identity",
  "vaccination",
  "doctor_visit",
  "prescription",
  "document",
  "memory",
] as const;
export type RecordCategory = (typeof recordCategories)[number];

export const recordSourceTypes = [
  "manual",
  "imported",
  "ocr_assisted",
  "ai_assisted",
  "provider_issued",
  "government_imported",
] as const;
export type RecordSourceType = (typeof recordSourceTypes)[number];

export const confirmationStates = ["draft", "suggested", "confirmed", "archived"] as const;
export type ConfirmationState = (typeof confirmationStates)[number];

export function requiredConsentForProcessing(
  processing: "child_profile" | "third_party_vision" | "cloud_ai_extraction",
): ConsentPurpose {
  if (processing === "third_party_vision") {
    return "third_party_vision_processing";
  }

  if (processing === "cloud_ai_extraction") {
    return "cloud_ai_extraction";
  }

  return "child_data_processing";
}

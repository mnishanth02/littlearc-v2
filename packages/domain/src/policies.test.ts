import { describe, expect, it } from "vitest";
import {
  canPerformHouseholdCapability,
  type HouseholdCapability,
  requiredConsentForProcessing,
} from "./index.js";

describe("household capability policy", () => {
  it("allows owners to manage household records and access", () => {
    expect(
      canPerformHouseholdCapability({
        capability: "deleteHousehold",
        role: "owner",
      }),
    ).toBe(true);
  });

  it("requires explicit caregiver grants", () => {
    const grants = new Set<HouseholdCapability>(["viewEmergencyCard", "manageTasks"]);

    expect(
      canPerformHouseholdCapability({
        capability: "viewEmergencyCard",
        grantedCapabilities: grants,
        role: "caregiver",
      }),
    ).toBe(true);
    expect(
      canPerformHouseholdCapability({
        capability: "inviteMembers",
        grantedCapabilities: grants,
        role: "caregiver",
      }),
    ).toBe(false);
  });

  it("keeps staff child-record visibility denied by default", () => {
    expect(
      canPerformHouseholdCapability({
        capability: "viewSelectedHealthRecords",
        role: "staff",
      }),
    ).toBe(false);
    expect(
      canPerformHouseholdCapability({
        capability: "manageEntitlement",
        purposeCodeRecorded: true,
        role: "staff",
      }),
    ).toBe(true);
  });

  it("maps sensitive processing to purpose-specific consent", () => {
    expect(requiredConsentForProcessing("child_profile")).toBe("child_data_processing");
    expect(requiredConsentForProcessing("third_party_vision")).toBe(
      "third_party_vision_processing",
    );
    expect(requiredConsentForProcessing("cloud_ai_extraction")).toBe("cloud_ai_extraction");
  });
});

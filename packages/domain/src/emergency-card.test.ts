import { describe, expect, it } from "vitest";
import {
  ageInYears,
  assertEmergencyCardContent,
  assertStandardEmergencyCardAccess,
  canEditEmergencyCard,
  canReadEmergencyCard,
  dialerUrl,
  type EmergencyCardContent,
} from "./emergency-card.js";

const content: EmergencyCardContent = {
  allergies: { state: "noneConfirmed" },
  bloodGroup: { state: "notProvided" },
  criticalNotes: { state: "notProvided" },
  dateOfBirth: "2020-07-23",
  guardianContacts: [
    { name: "Synthetic Guardian", phone: "+919999999999", relationship: "Parent" },
  ],
  pediatrician: { state: "notProvided" },
  preferredName: "Synthetic Child",
  urgentMedications: { state: "noneConfirmed" },
};

describe("OFF-05 emergency-card policy", () => {
  it("requires explicit values for confirmed states", () => {
    expect(() => assertEmergencyCardContent(content)).not.toThrow();
    expect(() =>
      assertEmergencyCardContent({
        ...content,
        allergies: { state: "confirmed", values: [] },
      }),
    ).toThrow("Confirmed allergies");
  });

  it("requires E.164 guardian contacts", () => {
    expect(() =>
      assertEmergencyCardContent({
        ...content,
        guardianContacts: [{ name: "Synthetic Guardian", phone: "99999", relationship: "Parent" }],
      }),
    ).toThrow("E.164");
    expect(dialerUrl("+919999999999")).toBe("tel:+919999999999");
  });

  it("keeps quick access unavailable until approval", () => {
    expect(() => assertStandardEmergencyCardAccess("standard")).not.toThrow();
    expect(() => assertStandardEmergencyCardAccess("quickAccess")).toThrow("not approved");
  });

  it("requires both caregiver capabilities for edits", () => {
    expect(canReadEmergencyCard({ role: "owner" })).toBe(true);
    expect(canEditEmergencyCard({ role: "owner" })).toBe(true);
    expect(
      canReadEmergencyCard({
        grantedCapabilities: new Set(["viewEmergencyCard"]),
        role: "caregiver",
      }),
    ).toBe(true);
    expect(
      canEditEmergencyCard({
        grantedCapabilities: new Set(["viewEmergencyCard"]),
        role: "caregiver",
      }),
    ).toBe(false);
    expect(
      canEditEmergencyCard({
        grantedCapabilities: new Set(["viewEmergencyCard", "editConfirmedRecords"]),
        role: "caregiver",
      }),
    ).toBe(true);
  });

  it("calculates age at the birthday boundary", () => {
    expect(ageInYears("2020-07-23", new Date("2026-07-22T12:00:00.000Z"))).toBe(5);
    expect(ageInYears("2020-07-23", new Date("2026-07-23T12:00:00.000Z"))).toBe(6);
  });
});

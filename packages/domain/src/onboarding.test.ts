import { describe, expect, it } from "vitest";
import {
  assertOwnerOnboardingPolicy,
  OwnerOnboardingPolicyError,
  off02NoticeVersions,
} from "./index.js";

const validInput = {
  adultVerification: { approved: true, decisionId: "synthetic-decision" },
  consents: [
    { noticeVersion: off02NoticeVersions.parentNotice, purpose: "parent_notice" as const },
    {
      noticeVersion: off02NoticeVersions.childDataProcessing,
      purpose: "child_data_processing" as const,
    },
  ],
  countryCode: "IN",
  timeZone: "Asia/Kolkata",
};

describe("owner onboarding policy", () => {
  it("accepts approved verification and exact required notice versions", () => {
    expect(() => assertOwnerOnboardingPolicy(validInput)).not.toThrow();
  });

  it("fails closed for verification, country, timezone, and consent drift", () => {
    for (const input of [
      { ...validInput, adultVerification: { approved: false, decisionId: "rejected" } },
      { ...validInput, countryCode: "in" },
      { ...validInput, timeZone: "IST" },
      { ...validInput, consents: validInput.consents.slice(0, 1) },
    ]) {
      expect(() => assertOwnerOnboardingPolicy(input)).toThrow(OwnerOnboardingPolicyError);
    }
  });
});

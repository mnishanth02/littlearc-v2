import type { ConsentPurpose } from "./policies.js";

export const off02NoticeVersions = {
  childDataProcessing: "child-data-processing-v1",
  parentNotice: "parent-notice-v1",
} as const;

export type AdultVerificationDecision = {
  readonly approved: boolean;
  readonly decisionId: string;
};

export type RequiredConsentAcceptance = {
  readonly purpose: Extract<ConsentPurpose, "parent_notice" | "child_data_processing">;
  readonly noticeVersion: string;
};

export class OwnerOnboardingPolicyError extends Error {
  readonly code:
    | "adult_verification_required"
    | "country_invalid"
    | "required_consent_missing"
    | "time_zone_invalid";

  constructor(code: OwnerOnboardingPolicyError["code"], message: string) {
    super(message);
    this.name = "OwnerOnboardingPolicyError";
    this.code = code;
  }
}

export function assertOwnerOnboardingPolicy(input: {
  readonly adultVerification: AdultVerificationDecision;
  readonly consents: ReadonlyArray<RequiredConsentAcceptance>;
  readonly countryCode: string;
  readonly timeZone: string;
}): void {
  if (!input.adultVerification.approved) {
    throw new OwnerOnboardingPolicyError(
      "adult_verification_required",
      "Approved adult verification is required.",
    );
  }
  if (!/^[A-Z]{2}$/.test(input.countryCode)) {
    throw new OwnerOnboardingPolicyError("country_invalid", "Country must be an ISO alpha-2 code.");
  }
  if (!isIanaTimeZone(input.timeZone)) {
    throw new OwnerOnboardingPolicyError(
      "time_zone_invalid",
      "Time zone must be a valid IANA zone.",
    );
  }

  const accepted = new Map(
    input.consents.map((consent) => [consent.purpose, consent.noticeVersion]),
  );
  if (
    accepted.get("parent_notice") !== off02NoticeVersions.parentNotice ||
    accepted.get("child_data_processing") !== off02NoticeVersions.childDataProcessing
  ) {
    throw new OwnerOnboardingPolicyError(
      "required_consent_missing",
      "Current parent notice and child-data consent are required.",
    );
  }
}

function isIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value.includes("/");
  } catch {
    return false;
  }
}

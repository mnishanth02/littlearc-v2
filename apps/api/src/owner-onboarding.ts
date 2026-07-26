import { createHash, randomBytes } from "node:crypto";
import type { StructuredPayloadCrypto } from "@littlearc/crypto";
import type { DatabaseClient, OwnerOnboardingResponse } from "@littlearc/database";
import { persistOwnerOnboarding } from "@littlearc/database";
import {
  assertOwnerOnboardingPolicy,
  createUuidV7,
  type off02NoticeVersions,
  type UuidV7,
} from "@littlearc/domain";

export type AdultVerificationPort = {
  readonly verify: (input: {
    readonly assertion: string;
    readonly identityUserId: string;
  }) => Promise<{ readonly approved: boolean; readonly decisionId: string }>;
};

export type OwnerOnboardingRequest = {
  readonly adultVerificationAssertion: string;
  readonly child: {
    readonly dateOfBirth: string;
    readonly preferredName: string;
  };
  readonly childDataConsentVersion: typeof off02NoticeVersions.childDataProcessing;
  readonly countryCode: string;
  readonly parent: {
    readonly displayName: string;
    readonly relationship: string;
  };
  readonly parentNoticeVersion: typeof off02NoticeVersions.parentNotice;
  readonly timeZone: string;
};

export type OwnerOnboardingCommand = {
  readonly execute: (input: {
    readonly idempotencyKey: UuidV7;
    readonly identityUserId: string;
    readonly request: OwnerOnboardingRequest;
    readonly requestId: UuidV7;
  }) => Promise<OwnerOnboardingResponse>;
};

export function createOwnerOnboardingCommand(options: {
  readonly adultVerification: AdultVerificationPort;
  readonly crypto: StructuredPayloadCrypto;
  readonly database: DatabaseClient;
}): OwnerOnboardingCommand {
  return {
    async execute(input) {
      const verification = await options.adultVerification.verify({
        assertion: input.request.adultVerificationAssertion,
        identityUserId: input.identityUserId,
      });
      assertOwnerOnboardingPolicy({
        adultVerification: verification,
        consents: [
          {
            noticeVersion: input.request.parentNoticeVersion,
            purpose: "parent_notice",
          },
          {
            noticeVersion: input.request.childDataConsentVersion,
            purpose: "child_data_processing",
          },
        ],
        countryCode: input.request.countryCode,
        timeZone: input.request.timeZone,
      });

      const identifiers = {
        childDataConsentId: nextId(),
        childId: nextId(),
        householdId: nextId(),
        householdKeyId: nextId(),
        membershipId: nextId(),
        parentNoticeConsentId: nextId(),
        parentProfileId: nextId(),
      };
      const householdKey = options.crypto.createHouseholdKey();
      try {
        const parentEnvelope = options.crypto.encrypt(
          {
            displayName: input.request.parent.displayName,
            relationship: input.request.parent.relationship,
          },
          {
            aadSchemaVersion: 1,
            householdId: identifiers.householdId,
            objectId: identifiers.parentProfileId,
            objectType: "parent_profile",
          },
          householdKey.plaintextKey,
          householdKey.wrapped.keyVersion,
        );
        const childEnvelope = options.crypto.encrypt(
          {
            dateOfBirth: input.request.child.dateOfBirth,
            preferredName: input.request.child.preferredName,
          },
          {
            aadSchemaVersion: 1,
            householdId: identifiers.householdId,
            objectId: identifiers.childId,
            objectType: "child_profile",
          },
          householdKey.plaintextKey,
          householdKey.wrapped.keyVersion,
        );

        return await persistOwnerOnboarding(options.database, {
          childEnvelope,
          countryCode: input.request.countryCode,
          idempotencyKey: input.idempotencyKey,
          identifiers,
          identityUserId: input.identityUserId,
          parentEnvelope,
          requestFingerprint: fingerprint(input.request),
          requestId: input.requestId,
          timeZone: input.request.timeZone,
          wrappedHouseholdKey: householdKey.wrapped,
        });
      } finally {
        householdKey.plaintextKey.fill(0);
      }
    },
  };
}

export function createSyntheticAdultVerification(): AdultVerificationPort {
  return {
    async verify(input) {
      return {
        approved: input.assertion === "synthetic-approved-off-02",
        decisionId: "synthetic-off-02-decision",
      };
    },
  };
}

export function nextId(): UuidV7 {
  return createUuidV7(randomBytes(10));
}

function fingerprint(request: OwnerOnboardingRequest): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(request)).digest("hex")}`;
}

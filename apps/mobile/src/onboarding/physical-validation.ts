import {
  deviceEnrollmentResponseSchema,
  ownerOnboardingResponseSchema,
} from "@littlearc/contracts";
import {
  createUuidV7,
  type EmergencyCardContent,
  parseUuidV7,
  type UuidV7,
} from "@littlearc/domain";
import type { QueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { getRandomBytes } from "expo-crypto";
import {
  enrollLocalSecurity,
  wipeLocalSecurity,
  withUnlockedLocalDatabase,
} from "../local-security/native";
import { localSchemaVersion } from "../local-security/policy";
import { synchronizationQueryOptions } from "../sync/query";
import { queueEmergencyCardUpdate, readLocalEmergencyCard } from "../sync/repository";

const validationHeaders = {
  "x-littlearc-synthetic-session": "off06-device-validation",
} as const;

const syntheticOwnerRequest = {
  adultVerificationAssertion: "synthetic-approved-off-02",
  child: {
    dateOfBirth: "2020-01-01",
    preferredName: "Synthetic Child",
  },
  childDataConsentVersion: "child-data-processing-v1",
  countryCode: "IN",
  parent: {
    displayName: "Synthetic Parent",
    relationship: "parent",
  },
  parentNoticeVersion: "parent-notice-v1",
  timeZone: "Asia/Kolkata",
} as const;

const syntheticEmergencyCard: EmergencyCardContent = {
  allergies: { state: "noneConfirmed" },
  bloodGroup: { state: "notProvided" },
  criticalNotes: { state: "notProvided" },
  dateOfBirth: "2020-01-01",
  guardianContacts: [
    { name: "Synthetic Guardian", phone: "+919999999999", relationship: "Parent" },
  ],
  pediatrician: { state: "notProvided" },
  preferredName: "Synthetic Child",
  urgentMedications: { state: "noneConfirmed" },
};

export type OnboardingActivationAdapter = {
  readonly confirmAccount: () => Promise<void>;
  readonly createEmergencyCard: () => Promise<void>;
  readonly createHousehold: () => Promise<void>;
  readonly verifyCompletion: () => Promise<void>;
};

export function createOff06PhysicalValidationAdapter(input: {
  readonly apiBaseUrl: string;
  readonly platform: "android" | "ios";
  readonly queryClient: QueryClient;
}): OnboardingActivationAdapter {
  const cardId = createUuidV7(getRandomBytes(10));
  const deviceId = createUuidV7(getRandomBytes(10));
  const emergencyIdempotencyKey = createUuidV7(getRandomBytes(10));
  const emergencyMutationId = createUuidV7(getRandomBytes(10));
  const onboardingIdempotencyKey = createUuidV7(getRandomBytes(10));
  let onboarding:
    | {
        readonly childId: UuidV7;
        readonly householdId: UuidV7;
      }
    | undefined;

  async function request(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(`${input.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...validationHeaders,
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`OFF-06 synthetic request failed with HTTP ${response.status}.`);
    }
    return response;
  }

  async function sync(householdId: string) {
    return withUnlockedLocalDatabase((database) =>
      input.queryClient.fetchQuery(
        synchronizationQueryOptions({
          apiBaseUrl: input.apiBaseUrl,
          database,
          headers: validationHeaders,
          householdId,
        }),
      ),
    );
  }

  return {
    async confirmAccount() {
      await wipeLocalSecurity();
      const response = (await (await request("/v1/validation/off06/session")).json()) as {
        ready?: unknown;
      };
      if (response.ready !== true) {
        throw new Error("The synthetic OFF-01 session checkpoint is unavailable.");
      }
    },

    async createHousehold() {
      const response = await request("/v1/households/onboarding", {
        body: JSON.stringify(syntheticOwnerRequest),
        headers: { "idempotency-key": onboardingIdempotencyKey },
        method: "POST",
      });
      const result = ownerOnboardingResponseSchema.parse(await response.json());
      onboarding = {
        childId: parseUuidV7(result.childId, "childId"),
        householdId: parseUuidV7(result.householdId, "householdId"),
      };
    },

    async createEmergencyCard() {
      if (!onboarding) {
        throw new Error("The synthetic household checkpoint is incomplete.");
      }
      const currentOnboarding = onboarding;
      let stage = "reset-local-security";
      try {
        await wipeLocalSecurity();
        stage = "request-device-enrollment";
        const enrollmentResponse = await request("/v1/devices/enrollment", {
          body: JSON.stringify({
            appVersion: Constants.expoConfig?.version ?? "0.0.0",
            deviceId,
            localSchemaVersion,
            platform: input.platform,
          }),
          method: "POST",
        });
        const enrollment = deviceEnrollmentResponseSchema.parse(await enrollmentResponse.json());
        if (enrollment.householdId !== currentOnboarding.householdId) {
          throw new Error("The device enrollment resolved another synthetic household.");
        }
        stage = "enroll-local-security";
        await enrollLocalSecurity({ deviceId, householdId: currentOnboarding.householdId });
        stage = "initial-synchronization";
        await sync(currentOnboarding.householdId);
        stage = "read-initial-card";
        const existingCard = await withUnlockedLocalDatabase((database) =>
          readLocalEmergencyCard(database, cardId),
        );
        if (!existingCard) {
          stage = "queue-emergency-card";
          await withUnlockedLocalDatabase((database) =>
            queueEmergencyCardUpdate(database, {
              cardId,
              childId: currentOnboarding.childId,
              content: syntheticEmergencyCard,
              idempotencyKey: emergencyIdempotencyKey,
              localDependencyIds: [],
              mutationId: emergencyMutationId,
              now: new Date().toISOString(),
            }),
          );
          stage = "final-synchronization";
          await sync(currentOnboarding.householdId);
        }
        stage = "verify-emergency-card";
        const card = await withUnlockedLocalDatabase((database) =>
          readLocalEmergencyCard(database, cardId),
        );
        if (card?.revision !== 1 || card.version !== 1 || card.syncStatus !== "synced") {
          throw new Error("The synthetic emergency card did not reach authoritative version 1.");
        }
      } catch {
        throw new Error(`OFF-06 synthetic ${stage} failed.`);
      }
    },

    async verifyCompletion() {
      const evidence = (await (await request("/v1/validation/off06/evidence")).json()) as Record<
        string,
        unknown
      >;
      const expected = {
        cards: "1",
        children: "1",
        consents: "2",
        devices: "1",
        households: "1",
        versions: "1",
      };
      if (
        Object.entries(expected).some(([key, value]) => evidence[key] !== value) ||
        evidence.status !== "passed"
      ) {
        throw new Error("The OFF-06 synthetic server evidence is incomplete.");
      }
    },
  };
}

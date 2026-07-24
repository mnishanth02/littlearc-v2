import { createUuidV7, type EmergencyCardContent } from "@littlearc/domain";
import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { getRandomBytes } from "expo-crypto";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { getMobileEnvironment } from "../../src/bootstrap/environment";
import { Banner } from "../../src/components/ui/Banner";
import { Button } from "../../src/components/ui/Button";
import { Typography } from "../../src/components/ui/Typography";
import { emergencyDialerUrl } from "../../src/emergency-card/presentation";
import {
  enrollLocalSecurity,
  verifyLocalSecurityWiped,
  wipeLocalSecurity,
  withUnlockedLocalDatabase,
} from "../../src/local-security/native";
import { synchronizationQueryOptions } from "../../src/sync/query";
import {
  countRiskyMutations,
  queueEmergencyCardUpdate,
  readLocalEmergencyCard,
} from "../../src/sync/repository";

type Step =
  | "setup"
  | "create"
  | "sync"
  | "offline"
  | "reconnect"
  | "conflict"
  | "wipe"
  | "complete"
  | "working"
  | "error";

const validationHeaders = {
  "x-littlearc-synthetic-session": "off05-device-validation",
} as const;
const content: EmergencyCardContent = {
  allergies: { state: "noneConfirmed" },
  bloodGroup: { state: "confirmed", value: "O+" },
  criticalNotes: { state: "confirmed", values: ["Synthetic critical note"] },
  dateOfBirth: "2020-01-01",
  guardianContacts: [
    { name: "Synthetic Guardian", phone: "+919999999999", relationship: "Parent" },
  ],
  pediatrician: {
    name: "Synthetic Pediatrician",
    phone: "+918888888888",
    state: "confirmed",
  },
  preferredName: "Synthetic Child",
  urgentMedications: { state: "noneConfirmed" },
};

export default function Off05ValidationScreen() {
  const environment = getMobileEnvironment();
  const queryClient = useQueryClient();
  const router = useRouter();
  const deviceId = useMemo(() => createUuidV7(getRandomBytes(10)), []);
  const [step, setStep] = useState<Step>("setup");
  const [identifiers, setIdentifiers] = useState<{
    readonly cardId: string;
    readonly childId: string;
    readonly householdId: string;
  }>();
  const [summary, setSummary] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  async function run(action: () => Promise<void>): Promise<void> {
    setStep("working");
    setErrorMessage(undefined);
    try {
      await action();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "OFF-05 validation failed.");
      setStep("error");
    }
  }

  async function request(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(`${environment.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...validationHeaders,
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Synthetic OFF-05 request returned HTTP ${response.status}.`);
    }
    return response;
  }

  async function setApiAvailability(available: boolean): Promise<void> {
    await request("/v1/validation/off05/connectivity", {
      body: JSON.stringify({ available }),
      method: "POST",
    });
  }

  async function sync(householdId: string) {
    return withUnlockedLocalDatabase((database) =>
      queryClient.fetchQuery(
        synchronizationQueryOptions({
          apiBaseUrl: environment.apiBaseUrl,
          database,
          headers: validationHeaders,
          householdId,
        }),
      ),
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.content}>
        <Typography accessibilityRole="header" textRole="screenTitle">
          OFF-05 emergency card
        </Typography>
        <Banner
          message="This proof uses fixed synthetic contacts and health states, a disposable database, standard post-unlock access, and one development client. It is not a quick-access, real-data, physical-iOS, or two-device claim."
          title="Synthetic evidence boundary"
          variant="warning"
        />

        {step === "setup" ? (
          <View style={styles.panel}>
            <Typography textRole="sectionTitle">1. Enroll SQLCipher schema V3</Typography>
            <Button
              label="Start clean OFF-05 proof"
              onPress={() =>
                void run(async () => {
                  await wipeLocalSecurity();
                  const bootstrap = (await (
                    await request("/v1/validation/off05/bootstrap")
                  ).json()) as { cardId: string; childId: string; householdId: string };
                  const enrollment = await request("/v1/devices/enrollment", {
                    body: JSON.stringify({
                      appVersion: Constants.expoConfig?.version ?? "0.0.1",
                      deviceId,
                      localSchemaVersion: 3,
                      platform: process.env.EXPO_OS === "ios" ? "ios" : "android",
                    }),
                    method: "POST",
                  });
                  const enrolled = (await enrollment.json()) as { householdId: string };
                  if (enrolled.householdId !== bootstrap.householdId) {
                    throw new Error("Device enrollment returned another synthetic household.");
                  }
                  await enrollLocalSecurity({ deviceId, householdId: bootstrap.householdId });
                  await sync(bootstrap.householdId);
                  setIdentifiers(bootstrap);
                  setSummary(`SQLCipher schema V3 · child snapshot ready`);
                  setStep("create");
                })
              }
              testID="off05-start"
            />
            <Button
              label="Resume retained OFF-05 proof"
              onPress={() =>
                void run(async () => {
                  const resumed = await withUnlockedLocalDatabase(async (database) => {
                    const enrollment = await database.getFirstAsync<{
                      readonly cardId: string | null;
                      readonly householdId: string;
                    }>(
                      `select
                        (select card_id from local_emergency_cards where card_id is not null limit 1) as "cardId",
                        household_id as "householdId"
                       from local_enrollment where singleton = 1`,
                    );
                    if (!enrollment?.cardId) {
                      throw new Error("No retained OFF-05 card was found.");
                    }
                    const card = await readLocalEmergencyCard(database, enrollment.cardId);
                    if (!card) {
                      throw new Error("The retained OFF-05 card is unavailable.");
                    }
                    return { card, householdId: enrollment.householdId };
                  });
                  setIdentifiers({
                    cardId: resumed.card.cardId,
                    childId: resumed.card.childId,
                    householdId: resumed.householdId,
                  });
                  if (
                    resumed.card.revision === 2 &&
                    resumed.card.version === 2 &&
                    resumed.card.syncStatus === "conflict"
                  ) {
                    setSummary("Revision 2 authoritative · retained conflict ready for evidence");
                    setStep("conflict");
                    return;
                  }
                  if (
                    resumed.card.revision !== 1 ||
                    resumed.card.version !== 1 ||
                    resumed.card.syncStatus !== "synced"
                  ) {
                    throw new Error("The retained confirmed card is incomplete.");
                  }
                  const connectivity = (await (
                    await request("/v1/validation/off05/connectivity")
                  ).json()) as { available: boolean };
                  if (connectivity.available) {
                    throw new Error("Put the synthetic API into outage mode before resuming.");
                  }
                  setSummary(
                    `${resumed.card.content.preferredName} · O+ · none confirmed allergies · API-offline version 1`,
                  );
                  setStep("reconnect");
                })
              }
              testID="off05-resume"
              variant="secondary"
            />
          </View>
        ) : null}

        {step === "create" && identifiers ? (
          <ValidationStep
            action="Save card while offline-ready"
            body="Commit explicit confirmed/not-provided states and one ordered mutation to SQLCipher."
            onPress={() =>
              void run(async () => {
                await withUnlockedLocalDatabase((database) =>
                  queueEmergencyCardUpdate(database, {
                    cardId: identifiers.cardId,
                    childId: identifiers.childId,
                    content,
                    idempotencyKey: createUuidV7(getRandomBytes(10)),
                    localDependencyIds: [],
                    mutationId: createUuidV7(getRandomBytes(10)),
                    now: new Date().toISOString(),
                  }),
                );
                const card = await withUnlockedLocalDatabase((database) =>
                  readLocalEmergencyCard(database, identifiers.cardId),
                );
                if (card?.syncStatus !== "pending") {
                  throw new Error("The optimistic emergency card was not durable.");
                }
                setSummary("Synthetic Child · pending · SQLCipher local read");
                setStep("sync");
              })
            }
            testID="off05-create"
            title="2. Atomic local creation"
          />
        ) : null}

        {step === "sync" && identifiers ? (
          <ValidationStep
            action="Synchronize version 1"
            body="Push the encrypted card and pull its authoritative immutable version."
            onPress={() =>
              void run(async () => {
                await sync(identifiers.householdId);
                const card = await withUnlockedLocalDatabase((database) =>
                  readLocalEmergencyCard(database, identifiers.cardId),
                );
                if (card?.revision !== 1 || card.version !== 1 || card.syncStatus !== "synced") {
                  throw new Error("The confirmed emergency-card version did not synchronize.");
                }
                setSummary("Version 1 confirmed · open Emergency, then simulate an API outage");
                setStep("offline");
              })
            }
            testID="off05-sync"
            title="3. Encrypted server version"
          />
        ) : null}

        {step === "offline" ? (
          <View style={styles.panel}>
            <Typography textRole="sectionTitle">4. Offline product route</Typography>
            <Typography>
              Open the production card, verify selectable facts and contact actions, return here,
              simulate an API outage, terminate LittleArc, relaunch, and use Resume.
            </Typography>
            <Button
              label="Simulate API outage for restart"
              onPress={() =>
                void run(async () => {
                  await setApiAvailability(false);
                  setSummary("Synthetic API unavailable · restart and resume from SQLCipher");
                  setStep("offline");
                })
              }
              testID="off05-outage"
              variant="secondary"
            />
            <Button
              label="Open production emergency card"
              onPress={() => router.push("/emergency")}
              testID="off05-open-card"
            />
          </View>
        ) : null}

        {step === "reconnect" && identifiers ? (
          <View style={styles.panel}>
            <Typography textRole="sectionTitle">5. Dialer and stale conflict</Typography>
            <Button
              accessibilityHint="Opens the dialer without placing a call"
              label="Open synthetic guardian dialer"
              onPress={() => void Linking.openURL(emergencyDialerUrl("+919999999999"))}
              testID="off05-dialer"
              variant="secondary"
            />
            <Button
              label="Reconnect and create stale conflict"
              onPress={() =>
                void run(async () => {
                  await setApiAvailability(true);
                  await request("/v1/validation/off05/remote-edit", { method: "POST" });
                  await withUnlockedLocalDatabase((database) =>
                    queueEmergencyCardUpdate(database, {
                      cardId: identifiers.cardId,
                      childId: identifiers.childId,
                      content: {
                        ...content,
                        criticalNotes: {
                          state: "confirmed",
                          values: ["Synthetic stale local critical note"],
                        },
                      },
                      idempotencyKey: createUuidV7(getRandomBytes(10)),
                      localDependencyIds: [],
                      mutationId: createUuidV7(getRandomBytes(10)),
                      now: new Date().toISOString(),
                    }),
                  );
                  await sync(identifiers.householdId);
                  const card = await withUnlockedLocalDatabase((database) =>
                    readLocalEmergencyCard(database, identifiers.cardId),
                  );
                  if (card?.syncStatus !== "conflict" || card.revision !== 2) {
                    throw new Error("The stale emergency-card conflict was not preserved.");
                  }
                  const risky = await withUnlockedLocalDatabase(countRiskyMutations);
                  setSummary(`Revision 2 authoritative · ${risky} local proposal needs review`);
                  setStep("conflict");
                })
              }
              testID="off05-conflict"
            />
          </View>
        ) : null}

        {step === "conflict" && identifiers ? (
          <ValidationStep
            action="Verify server evidence"
            body="Confirm two immutable versions and minimized audit/change/outbox evidence."
            onPress={() =>
              void run(async () => {
                const evidence = (await (
                  await request("/v1/validation/off05/evidence")
                ).json()) as {
                  audit: string;
                  changes: string;
                  outbox: string;
                  revision: number;
                  versions: string;
                };
                if (
                  evidence.versions !== "2" ||
                  evidence.audit !== "2" ||
                  evidence.changes !== "2" ||
                  evidence.outbox !== "2" ||
                  evidence.revision !== 2
                ) {
                  throw new Error("Emergency-card server evidence counts are incomplete.");
                }
                setSummary("2 immutable versions · 2 audit/change/outbox records · no duplicate");
                setStep("wipe");
              })
            }
            testID="off05-evidence"
            title="6. Immutable history"
          />
        ) : null}

        {step === "wipe" ? (
          <ValidationStep
            action="Discard conflict and verify wipe"
            body="Explicitly discard the synthetic proposal and make the emergency card inaccessible."
            onPress={() =>
              void run(async () => {
                await wipeLocalSecurity();
                if (!(await verifyLocalSecurityWiped())) {
                  throw new Error("Sensitive local emergency data remained after wipe.");
                }
                setSummary("OFF-05 device validation passed");
                setStep("complete");
              })
            }
            testID="off05-wipe"
            title="7. Sign-out-equivalent wipe"
          />
        ) : null}

        {step === "working" ? (
          <Banner
            message="The current validation action is running."
            title="Working"
            variant="info"
          />
        ) : null}
        {step === "error" && errorMessage ? (
          <Banner message={errorMessage} title="OFF-05 validation stopped" variant="danger" />
        ) : null}
        {step === "complete" ? (
          <Banner
            message="The standard-access encrypted emergency-card lifecycle completed on this device."
            title="OFF-05 device validation passed"
            variant="success"
          />
        ) : null}
        {summary ? (
          <View style={styles.summary}>
            <Typography selectable textRole="caption" tone="muted">
              Latest evidence
            </Typography>
            <Typography selectable testID="off05-summary">
              {summary}
            </Typography>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function ValidationStep(props: {
  readonly action: string;
  readonly body: string;
  readonly onPress: () => void;
  readonly testID: string;
  readonly title: string;
}) {
  return (
    <View style={styles.panel}>
      <Typography textRole="sectionTitle">{props.title}</Typography>
      <Typography>{props.body}</Typography>
      <Button label={props.action} onPress={props.onPress} testID={props.testID} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  shell: {
    alignItems: "center",
    backgroundColor: theme.colors.background.primary,
    flexGrow: 1,
    padding: theme.layout.screenPadding,
  },
  content: {
    gap: theme.spacing.lg,
    maxWidth: theme.layout.contentMaxWidth,
    paddingVertical: theme.spacing.xl,
    width: "100%",
  },
  panel: {
    backgroundColor: theme.colors.background.elevated,
    borderColor: theme.colors.border.default,
    borderCurve: "continuous",
    borderRadius: theme.radii.card,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  summary: {
    backgroundColor: theme.colors.background.secondary,
    borderCurve: "continuous",
    borderRadius: theme.radii.card,
    gap: theme.spacing.xxs,
    padding: theme.spacing.md,
  },
}));

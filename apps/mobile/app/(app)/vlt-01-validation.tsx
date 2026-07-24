import { recordVersionPageSchema } from "@littlearc/contracts";
import { createUuidV7, type RecordVersionContentV1 } from "@littlearc/domain";
import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { getRandomBytes } from "expo-crypto";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { getMobileEnvironment } from "../../src/bootstrap/environment";
import { Banner } from "../../src/components/ui/Banner";
import { Button } from "../../src/components/ui/Button";
import { Typography } from "../../src/components/ui/Typography";
import {
  enrollLocalSecurity,
  validateUnlockedLocalSecurity,
  verifyLocalSecurityWiped,
  wipeLocalSecurity,
  withUnlockedLocalDatabase,
} from "../../src/local-security/native";
import { synchronizationQueryOptions } from "../../src/sync/query";
import {
  cacheRecordVersions,
  countRiskyMutations,
  queueRecordUpsert,
  readLocalRecord,
  readLocalRecordVersions,
  readLocalTimeline,
} from "../../src/sync/repository";

type Step =
  | "setup"
  | "create"
  | "sync"
  | "offline"
  | "correct"
  | "conflict"
  | "evidence"
  | "wipe"
  | "complete"
  | "working"
  | "error";

const validationHeaders = {
  "x-littlearc-synthetic-session": "vlt01-device-validation",
} as const;
const originalContent: RecordVersionContentV1 = {
  details: {
    documentKind: { state: "confirmed", value: "Synthetic visit summary" },
    schema: "document.v1",
  },
  notes: { state: "notProvided" },
  providerFacility: { state: "confirmed", value: "Synthetic Clinic" },
  schemaVersion: 1,
  title: "Synthetic pediatric visit",
};
const correctedContent: RecordVersionContentV1 = {
  ...originalContent,
  notes: { state: "confirmed", value: "Synthetic caregiver correction" },
  title: "Synthetic pediatric follow-up",
};

export default function Vlt01ValidationScreen() {
  const environment = getMobileEnvironment();
  const queryClient = useQueryClient();
  const deviceId = useMemo(() => createUuidV7(getRandomBytes(10)), []);
  const [step, setStep] = useState<Step>("setup");
  const [identifiers, setIdentifiers] = useState<{
    readonly childId: string;
    readonly householdId: string;
    readonly recordId: string;
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
      setErrorMessage(error instanceof Error ? error.message : "VLT-01 validation failed.");
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
      throw new Error(`Synthetic VLT-01 request returned HTTP ${response.status}.`);
    }
    return response;
  }

  async function setApiAvailability(available: boolean): Promise<void> {
    await request("/v1/validation/vlt01/connectivity", {
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
          VLT-01 record foundation
        </Typography>
        <Banner
          message="This development-only proof uses one bounded synthetic document payload, the current SQLCipher schema, manual provenance, and a generated Timeline projection. It is not VLT-02 product UI, real-provider evidence, physical-iOS evidence, a two-device claim, or Gate 2 closure."
          title="Synthetic evidence boundary"
          variant="warning"
        />

        {step === "setup" ? (
          <View style={styles.panel}>
            <Typography textRole="sectionTitle">1. Enroll current SQLCipher schema</Typography>
            <Button
              label="Start clean VLT-01 proof"
              onPress={() =>
                void run(async () => {
                  await wipeLocalSecurity();
                  const bootstrap = (await (
                    await request("/v1/validation/vlt01/bootstrap")
                  ).json()) as {
                    childId: string;
                    householdId: string;
                    recordId: string;
                  };
                  const enrollment = await request("/v1/devices/enrollment", {
                    body: JSON.stringify({
                      appVersion: Constants.expoConfig?.version ?? "0.0.1",
                      deviceId,
                      localSchemaVersion: 5,
                      platform: process.env.EXPO_OS === "ios" ? "ios" : "android",
                    }),
                    method: "POST",
                  });
                  const enrolled = (await enrollment.json()) as { householdId: string };
                  if (enrolled.householdId !== bootstrap.householdId) {
                    throw new Error("Device enrollment returned another synthetic household.");
                  }
                  await enrollLocalSecurity({ deviceId, householdId: bootstrap.householdId });
                  const security = await validateUnlockedLocalSecurity();
                  if (security.migrationVersion !== 5 || !security.reopenPassed) {
                    throw new Error("SQLCipher schema V5 did not survive a keyed reopen.");
                  }
                  await sync(bootstrap.householdId);
                  setIdentifiers(bootstrap);
                  setSummary(`SQLCipher ${security.cipherVersion} · schema V5 · child ready`);
                  setStep("create");
                })
              }
              testID="vlt01-start"
            />
            <Button
              label="Resume after offline restart"
              onPress={() =>
                void run(async () => {
                  const retained = await withUnlockedLocalDatabase(async (database) => {
                    const enrollment = await database.getFirstAsync<{
                      readonly householdId: string;
                      readonly recordId: string | null;
                    }>(
                      `select
                        household_id as "householdId",
                        (select record_id from local_records limit 1) as "recordId"
                       from local_enrollment where singleton = 1`,
                    );
                    if (!enrollment?.recordId) {
                      throw new Error("No retained VLT-01 record was found.");
                    }
                    const record = await readLocalRecord(database, enrollment.recordId);
                    if (record?.revision !== 1 || record.syncStatus !== "synced") {
                      throw new Error("The retained record is not the confirmed version 1.");
                    }
                    const timeline = await readLocalTimeline(database, record.childId);
                    if (timeline.length !== 1 || timeline[0]?.recordId !== record.recordId) {
                      throw new Error("The retained generated Timeline projection is incomplete.");
                    }
                    return { enrollment, record };
                  });
                  const connectivity = (await (
                    await request("/v1/validation/vlt01/connectivity")
                  ).json()) as { available: boolean };
                  if (connectivity.available) {
                    throw new Error("Put the synthetic API into outage mode before resuming.");
                  }
                  setIdentifiers({
                    childId: retained.record.childId,
                    householdId: retained.enrollment.householdId,
                    recordId: retained.record.recordId,
                  });
                  setSummary(
                    "Version 1 and Timeline reopened from SQLCipher while API unavailable",
                  );
                  setStep("correct");
                })
              }
              testID="vlt01-resume"
              variant="secondary"
            />
          </View>
        ) : null}

        {step === "create" && identifiers ? (
          <ValidationStep
            action="Save synthetic manual record"
            body="Commit one ordered record mutation and its local generated Timeline projection."
            onPress={() =>
              void run(async () => {
                await withUnlockedLocalDatabase((database) =>
                  queueRecordUpsert(database, {
                    category: "document",
                    childId: identifiers.childId,
                    content: originalContent,
                    eventAt: "2026-07-20T09:00:00.000Z",
                    idempotencyKey: createUuidV7(getRandomBytes(10)),
                    localDependencyIds: [],
                    mutationId: createUuidV7(getRandomBytes(10)),
                    now: new Date().toISOString(),
                    recordId: identifiers.recordId,
                    sourceType: "manual",
                  }),
                );
                const local = await withUnlockedLocalDatabase(async (database) => ({
                  record: await readLocalRecord(database, identifiers.recordId),
                  timeline: await readLocalTimeline(database, identifiers.childId),
                }));
                if (local.record?.syncStatus !== "pending" || local.timeline.length !== 1) {
                  throw new Error(
                    "The optimistic record and Timeline projection were not durable.",
                  );
                }
                setSummary("Manual provenance · pending record · one local Timeline projection");
                setStep("sync");
              })
            }
            testID="vlt01-create"
            title="2. Atomic local creation"
          />
        ) : null}

        {step === "sync" && identifiers ? (
          <ValidationStep
            action="Synchronize version 1"
            body="Push encrypted content and pull the authoritative record and Timeline projection."
            onPress={() =>
              void run(async () => {
                await sync(identifiers.householdId);
                const local = await withUnlockedLocalDatabase(async (database) => ({
                  record: await readLocalRecord(database, identifiers.recordId),
                  timeline: await readLocalTimeline(database, identifiers.childId),
                }));
                if (
                  local.record?.revision !== 1 ||
                  local.record.version !== 1 ||
                  local.record.syncStatus !== "synced" ||
                  local.timeline[0]?.sourceVersionId !== local.record.versionId
                ) {
                  throw new Error("Record version 1 and Timeline authority did not synchronize.");
                }
                setSummary("Version 1 confirmed · generated Timeline linked to version 1");
                setStep("offline");
              })
            }
            testID="vlt01-sync"
            title="3. Encrypted server version"
          />
        ) : null}

        {step === "offline" ? (
          <View style={styles.panel}>
            <Typography textRole="sectionTitle">4. Offline restart</Typography>
            <Typography>
              Simulate the API outage, terminate LittleArc, relaunch it, reopen this screen, and
              choose Resume after offline restart.
            </Typography>
            <Button
              label="Simulate API outage"
              onPress={() =>
                void run(async () => {
                  await setApiAvailability(false);
                  setSummary("Synthetic API unavailable · terminate and relaunch LittleArc");
                  setStep("offline");
                })
              }
              testID="vlt01-outage"
              variant="secondary"
            />
          </View>
        ) : null}

        {step === "correct" && identifiers ? (
          <ValidationStep
            action="Reconnect and save correction"
            body="Append immutable version 2, replace the active Timeline projection, and cache history."
            onPress={() =>
              void run(async () => {
                await setApiAvailability(true);
                await withUnlockedLocalDatabase((database) =>
                  queueRecordUpsert(database, {
                    category: "document",
                    childId: identifiers.childId,
                    content: correctedContent,
                    eventAt: "2026-07-20T09:00:00.000Z",
                    idempotencyKey: createUuidV7(getRandomBytes(10)),
                    localDependencyIds: [],
                    mutationId: createUuidV7(getRandomBytes(10)),
                    now: new Date().toISOString(),
                    recordId: identifiers.recordId,
                    sourceType: "manual",
                  }),
                );
                await sync(identifiers.householdId);
                const versions = recordVersionPageSchema.parse(
                  await (
                    await request(`/v1/records/${identifiers.recordId}/versions?limit=20`)
                  ).json(),
                );
                await withUnlockedLocalDatabase((database) =>
                  cacheRecordVersions(database, versions.items),
                );
                const local = await withUnlockedLocalDatabase(async (database) => ({
                  history: await readLocalRecordVersions(database, identifiers.recordId),
                  record: await readLocalRecord(database, identifiers.recordId),
                  timeline: await readLocalTimeline(database, identifiers.childId),
                }));
                if (
                  local.record?.revision !== 2 ||
                  local.record.version !== 2 ||
                  local.history.length !== 2 ||
                  local.timeline.length !== 1 ||
                  local.timeline[0]?.content.title !== correctedContent.title
                ) {
                  throw new Error("Immutable correction history or Timeline replacement failed.");
                }
                setSummary("2 immutable versions · one active Timeline entry · history cached");
                setStep("conflict");
              })
            }
            testID="vlt01-correct"
            title="5. Correction and history"
          />
        ) : null}

        {step === "conflict" && identifiers ? (
          <ValidationStep
            action="Create stale correction conflict"
            body="Apply remote version 3, then preserve a stale local correction for explicit review."
            onPress={() =>
              void run(async () => {
                await request("/v1/validation/vlt01/remote-edit", { method: "POST" });
                await withUnlockedLocalDatabase((database) =>
                  queueRecordUpsert(database, {
                    category: "document",
                    childId: identifiers.childId,
                    content: {
                      ...correctedContent,
                      title: "Synthetic stale local visit",
                    },
                    eventAt: "2026-07-20T09:00:00.000Z",
                    idempotencyKey: createUuidV7(getRandomBytes(10)),
                    localDependencyIds: [],
                    mutationId: createUuidV7(getRandomBytes(10)),
                    now: new Date().toISOString(),
                    recordId: identifiers.recordId,
                    sourceType: "manual",
                  }),
                );
                await sync(identifiers.householdId);
                const record = await withUnlockedLocalDatabase((database) =>
                  readLocalRecord(database, identifiers.recordId),
                );
                const risky = await withUnlockedLocalDatabase(countRiskyMutations);
                if (record?.syncStatus !== "conflict" || record.revision !== 3 || risky !== 1) {
                  throw new Error("The stale record correction was not preserved for review.");
                }
                setSummary("Revision 3 authoritative · one stale local proposal preserved");
                setStep("evidence");
              })
            }
            testID="vlt01-conflict"
            title="6. Explicit conflict"
          />
        ) : null}

        {step === "evidence" ? (
          <ValidationStep
            action="Verify PostgreSQL evidence"
            body="Confirm version, audit, change-feed, and one-active-Timeline invariants."
            onPress={() =>
              void run(async () => {
                const evidence = (await (
                  await request("/v1/validation/vlt01/evidence")
                ).json()) as {
                  activeTimeline: string;
                  audit: string;
                  recordChanges: string;
                  revision: number;
                  timelineChanges: string;
                  versions: string;
                };
                if (
                  evidence.versions !== "3" ||
                  evidence.audit !== "3" ||
                  evidence.recordChanges !== "3" ||
                  evidence.timelineChanges !== "5" ||
                  evidence.activeTimeline !== "1" ||
                  evidence.revision !== 3
                ) {
                  throw new Error("VLT-01 server evidence counts are incomplete.");
                }
                setSummary("3 versions · 3 audit/record changes · 5 Timeline changes · 1 active");
                setStep("wipe");
              })
            }
            testID="vlt01-evidence"
            title="7. Server invariants"
          />
        ) : null}

        {step === "wipe" ? (
          <ValidationStep
            action="Discard conflict and verify wipe"
            body="Remove the SQLCipher database, WAL/SHM sidecars, and protected key material."
            onPress={() =>
              void run(async () => {
                await wipeLocalSecurity();
                if (!(await verifyLocalSecurityWiped())) {
                  throw new Error("Sensitive local VLT-01 data remained after wipe.");
                }
                setSummary("VLT-01 device validation passed");
                setStep("complete");
              })
            }
            testID="vlt01-wipe"
            title="8. Sign-out-equivalent wipe"
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
          <Banner message={errorMessage} title="VLT-01 validation stopped" variant="danger" />
        ) : null}
        {step === "complete" ? (
          <Banner
            message="The encrypted record, immutable history, generated Timeline, conflict, and wipe lifecycle completed on this device."
            title="VLT-01 device validation passed"
            variant="success"
          />
        ) : null}
        {summary ? (
          <View style={styles.summary}>
            <Typography selectable textRole="caption" tone="muted">
              Latest evidence
            </Typography>
            <Typography selectable testID="vlt01-summary">
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
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  shell: {
    alignItems: "center",
    backgroundColor: theme.colors.background.primary,
    flexGrow: 1,
    padding: theme.layout.screenPadding,
  },
  summary: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.radii.control,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
}));

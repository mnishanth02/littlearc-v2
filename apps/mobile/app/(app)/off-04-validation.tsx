import { createUuidV7 } from "@littlearc/domain";
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
  verifyLocalSecurityWiped,
  wipeLocalSecurity,
  withUnlockedLocalDatabase,
} from "../../src/local-security/native";
import { synchronizationQueryOptions } from "../../src/sync/query";
import {
  countRiskyMutations,
  type QueuedChildMutation,
  queueChildProfileUpdate,
  readLocalChildProfile,
} from "../../src/sync/repository";

type Step =
  | "setup"
  | "initial"
  | "offline"
  | "push"
  | "duplicate"
  | "conflict"
  | "tombstone"
  | "reset"
  | "restart"
  | "wipe"
  | "complete"
  | "working"
  | "error";

const validationHeaders = { "x-littlearc-synthetic-session": "off04-pixel8" } as const;

export default function Off04ValidationScreen() {
  const environment = getMobileEnvironment();
  const queryClient = useQueryClient();
  const deviceId = useMemo(() => createUuidV7(getRandomBytes(10)), []);
  const [step, setStep] = useState<Step>("setup");
  const [identifiers, setIdentifiers] = useState<{
    readonly childId: string;
    readonly householdId: string;
  }>();
  const [firstMutation, setFirstMutation] = useState<QueuedChildMutation>();
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
      setErrorMessage(error instanceof Error ? error.message : "OFF-04 validation failed.");
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
      throw new Error(`Synthetic OFF-04 request returned HTTP ${response.status}.`);
    }
    return response;
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
          OFF-04 repository and sync
        </Typography>
        <Banner
          message="This development-only proof uses one fixed synthetic child, a temporary database, and a server-simulated second writer. It is not a two-device or real-data claim."
          title="Synthetic evidence boundary"
          variant="warning"
        />

        {step === "setup" ? (
          <View style={styles.panel}>
            <Typography textRole="sectionTitle">1. Enroll a clean repository</Typography>
            <Typography>
              Register this installation, create SQLCipher schema V2, and bind the local repository
              to the synthetic household.
            </Typography>
            <Button
              label="Start clean OFF-04 proof"
              onPress={() =>
                void run(async () => {
                  await wipeLocalSecurity();
                  const bootstrap = (await (
                    await request("/v1/validation/off04/bootstrap")
                  ).json()) as { childId: string; householdId: string };
                  const enrollment = await request("/v1/devices/enrollment", {
                    body: JSON.stringify({
                      appVersion: Constants.expoConfig?.version ?? "0.0.1",
                      deviceId,
                      localSchemaVersion: 2,
                      platform: "android",
                    }),
                    method: "POST",
                  });
                  const enrolled = (await enrollment.json()) as { householdId: string };
                  if (enrolled.householdId !== bootstrap.householdId) {
                    throw new Error("Device enrollment returned another synthetic household.");
                  }
                  await enrollLocalSecurity({ deviceId, householdId: bootstrap.householdId });
                  setIdentifiers(bootstrap);
                  setSummary(`SQLCipher schema V2 · household ${bootstrap.householdId}`);
                  setStep("initial");
                })
              }
              testID="off04-start"
            />
            <Button
              label="Resume after process restart"
              onPress={() =>
                void run(async () => {
                  const resumed = await withUnlockedLocalDatabase(async (database) => {
                    const enrollment = await database.getFirstAsync<{
                      childId: string | null;
                      householdId: string;
                    }>(
                      `select
                        (select child_id from local_children limit 1) as "childId",
                        household_id as "householdId"
                       from local_enrollment where singleton = 1`,
                    );
                    if (!enrollment?.childId) {
                      throw new Error("No retained OFF-04 repository state was found.");
                    }
                    const child = await readLocalChildProfile(database, enrollment.childId);
                    const risky = await countRiskyMutations(database);
                    if (child?.syncStatus !== "conflict" || !child.deletedAt || risky < 1) {
                      throw new Error("Retained repository state did not preserve the conflict.");
                    }
                    return { child, householdId: enrollment.householdId, risky };
                  });
                  setSummary(
                    `Process restart retained ${resumed.child.preferredName} · tombstone conflict · ${resumed.risky} review item(s)`,
                  );
                  setStep("wipe");
                })
              }
              testID="off04-resume"
              variant="secondary"
            />
          </View>
        ) : null}

        {step === "initial" && identifiers ? (
          <ValidationStep
            action="Run initial reset and snapshot"
            body="Use the signed reset contract, stage the snapshot, and open the child from SQLCipher."
            onPress={() =>
              void run(async () => {
                const result = await sync(identifiers.householdId);
                const child = await withUnlockedLocalDatabase((database) =>
                  readLocalChildProfile(database, identifiers.childId),
                );
                if (!result.resetPerformed || child?.preferredName !== "Synthetic Child") {
                  throw new Error("Initial reconciliation did not populate the child repository.");
                }
                setSummary(`${child.preferredName} · revision ${child.revision} · SQLCipher read`);
                setStep("offline");
              })
            }
            testID="off04-initial"
            title="2. Initial reconciliation"
          />
        ) : null}

        {step === "offline" && identifiers ? (
          <ValidationStep
            action="Queue optimistic edit"
            body="With network disabled, commit the local profile and its ordered mutation together."
            onPress={() =>
              void run(async () => {
                const mutationId = createUuidV7(getRandomBytes(10));
                const idempotencyKey = createUuidV7(getRandomBytes(10));
                await withUnlockedLocalDatabase((database) =>
                  queueChildProfileUpdate(database, {
                    childId: identifiers.childId,
                    idempotencyKey,
                    localDependencyIds: [],
                    mutationId,
                    now: new Date().toISOString(),
                    payload: {
                      dateOfBirth: "2020-01-01",
                      preferredName: "Local Synthetic Child",
                    },
                  }),
                );
                const child = await withUnlockedLocalDatabase((database) =>
                  readLocalChildProfile(database, identifiers.childId),
                );
                if (
                  child?.preferredName !== "Local Synthetic Child" ||
                  child.syncStatus !== "pending"
                ) {
                  throw new Error("The optimistic repository write was not durable.");
                }
                setFirstMutation({
                  attempts: 0,
                  baseRevision: child.revision,
                  entityId: identifiers.childId,
                  idempotencyKey,
                  localDependencyIds: [],
                  mutationId,
                  nextAttemptAt: null,
                  payload: {
                    dateOfBirth: child.dateOfBirth,
                    preferredName: child.preferredName,
                  },
                  status: "pending",
                });
                setSummary("Local Synthetic Child · pending · no network call");
                setStep("push");
              })
            }
            testID="off04-offline"
            title="3. Offline optimistic mutation"
          />
        ) : null}

        {step === "push" && identifiers ? (
          <ValidationStep
            action="Reconnect and synchronize"
            body="Push the due mutation, atomically update server evidence, and pull the authoritative revision."
            onPress={() =>
              void run(async () => {
                const result = await sync(identifiers.householdId);
                const child = await withUnlockedLocalDatabase((database) =>
                  readLocalChildProfile(database, identifiers.childId),
                );
                if (
                  result.mutationCount !== 1 ||
                  child?.revision !== 2 ||
                  child.syncStatus !== "synced"
                ) {
                  throw new Error("The optimistic mutation did not synchronize to revision 2.");
                }
                setSummary(`${child.preferredName} · revision 2 · synced`);
                setStep("duplicate");
              })
            }
            testID="off04-push"
            title="4. Mutation push and pull"
          />
        ) : null}

        {step === "duplicate" && firstMutation ? (
          <ValidationStep
            action="Replay the exact mutation"
            body="Retry the same mutation and idempotency key; no revision or evidence row may duplicate."
            onPress={() =>
              void run(async () => {
                const response = await request("/v1/sync/mutations", {
                  body: JSON.stringify({
                    mutations: [
                      {
                        baseRevision: firstMutation.baseRevision,
                        entityId: firstMutation.entityId,
                        entityType: "child",
                        idempotencyKey: firstMutation.idempotencyKey,
                        localDependencyIds: [],
                        mutationId: firstMutation.mutationId,
                        operation: "update",
                        payload: firstMutation.payload,
                      },
                    ],
                  }),
                  method: "POST",
                });
                const body = (await response.json()) as { results: Array<{ status: string }> };
                if (body.results[0]?.status !== "duplicate") {
                  throw new Error("The exact mutation retry was not classified as duplicate.");
                }
                setSummary("Exact retry · duplicate · server revision remains 2");
                setStep("conflict");
              })
            }
            testID="off04-duplicate"
            title="5. Exact duplicate replay"
          />
        ) : null}

        {step === "conflict" && identifiers ? (
          <ValidationStep
            action="Create and review stale conflict"
            body="Queue a local critical edit, apply a server-simulated second writer, then preserve both copies."
            onPress={() =>
              void run(async () => {
                await withUnlockedLocalDatabase((database) =>
                  queueChildProfileUpdate(database, {
                    childId: identifiers.childId,
                    idempotencyKey: createUuidV7(getRandomBytes(10)),
                    localDependencyIds: [],
                    mutationId: createUuidV7(getRandomBytes(10)),
                    now: new Date().toISOString(),
                    payload: {
                      dateOfBirth: "2020-01-01",
                      preferredName: "Conflicting Local Child",
                    },
                  }),
                );
                await request("/v1/validation/off04/remote-edit", { method: "POST" });
                await sync(identifiers.householdId);
                const child = await withUnlockedLocalDatabase((database) =>
                  readLocalChildProfile(database, identifiers.childId),
                );
                if (
                  child?.preferredName !== "Conflicting Local Child" ||
                  child.revision !== 3 ||
                  child.syncStatus !== "conflict"
                ) {
                  throw new Error("The stale critical conflict did not preserve the local copy.");
                }
                setSummary("Local proposal preserved · server revision 3 · review required");
                setStep("tombstone");
              })
            }
            testID="off04-conflict"
            title="6. Critical-field conflict"
          />
        ) : null}

        {step === "tombstone" && identifiers ? (
          <ValidationStep
            action="Propagate server tombstone"
            body="Apply an atomic synthetic deletion event; the stale proposal cannot resurrect the child."
            onPress={() =>
              void run(async () => {
                await request("/v1/validation/off04/tombstone", { method: "POST" });
                await sync(identifiers.householdId);
                const child = await withUnlockedLocalDatabase((database) =>
                  readLocalChildProfile(database, identifiers.childId),
                );
                if (!child?.deletedAt || child.syncStatus !== "conflict") {
                  throw new Error("The server tombstone did not win over pending local work.");
                }
                setSummary("Tombstone won · local proposal retained only for explicit review");
                setStep("reset");
              })
            }
            testID="off04-tombstone"
            title="7. Tombstone propagation"
          />
        ) : null}

        {step === "reset" && identifiers ? (
          <ValidationStep
            action="Expire cursor and rebuild"
            body="Advance the retained sequence floor, stage a fresh snapshot, and preserve the conflicted proposal."
            onPress={() =>
              void run(async () => {
                await request("/v1/validation/off04/expire-cursor", { method: "POST" });
                const result = await sync(identifiers.householdId);
                const child = await withUnlockedLocalDatabase((database) =>
                  readLocalChildProfile(database, identifiers.childId),
                );
                if (
                  !result.resetPerformed ||
                  !child?.deletedAt ||
                  child.syncStatus !== "conflict"
                ) {
                  throw new Error("Cursor reset did not preserve the conflicted local proposal.");
                }
                const evidence = (await (
                  await request("/v1/validation/off04/evidence")
                ).json()) as { audit: string; outbox: string; revision: number };
                if (
                  evidence.revision !== 4 ||
                  Number(evidence.audit) < 3 ||
                  Number(evidence.outbox) < 3
                ) {
                  throw new Error("Server audit/outbox evidence was incomplete.");
                }
                setSummary("Expired cursor rebuilt · server revision 4 · pending review preserved");
                setStep("restart");
              })
            }
            testID="off04-reset"
            title="8. Cursor expiry and full reconciliation"
          />
        ) : null}

        {step === "restart" ? (
          <View style={styles.panel}>
            <Typography textRole="sectionTitle">9. Process restart</Typography>
            <Typography>
              Force-stop and reopen LittleArc, return to this screen, then choose “Resume after
              process restart.” The retained conflict must reopen from SQLCipher without Query cache
              state.
            </Typography>
          </View>
        ) : null}

        {step === "wipe" ? (
          <ValidationStep
            action="Confirm discard and wipe"
            body="The review item makes sign-out destructive. Confirm it explicitly, then verify all local artifacts are inaccessible."
            onPress={() =>
              void run(async () => {
                const risky = await withUnlockedLocalDatabase(countRiskyMutations);
                if (risky < 1) {
                  throw new Error("The sign-out warning did not find unsynchronized review work.");
                }
                await wipeLocalSecurity();
                if (!(await verifyLocalSecurityWiped())) {
                  throw new Error("OFF-04 sign-out cleanup left local artifacts.");
                }
                setSummary(`Explicitly discarded ${risky} review item(s) · verified wipe`);
                setStep("complete");
              })
            }
            testID="off04-wipe"
            title="10. Unsynchronized-write warning and wipe"
          />
        ) : null}

        {step === "working" ? (
          <View accessibilityLiveRegion="polite" style={styles.panel}>
            <Typography textRole="sectionTitle">Running OFF-04 validation</Typography>
            <Button disabled label="Synchronizing" loading />
          </View>
        ) : null}
        {step === "error" ? (
          <Banner
            actionLabel="Return to clean setup"
            message={errorMessage ?? "The OFF-04 validation flow could not continue."}
            onActionPress={() =>
              void run(async () => {
                await wipeLocalSecurity();
                setIdentifiers(undefined);
                setFirstMutation(undefined);
                setSummary("Synthetic local state reset");
                setStep("setup");
              })
            }
            title="Synchronization validation stopped"
            variant="danger"
          />
        ) : null}
        {step === "complete" ? (
          <View
            accessibilityLabel="OFF-04 physical Android validation passed"
            accessibilityRole="summary"
            style={styles.panel}
          >
            <Typography textRole="sectionTitle">Repository and sync lifecycle passed</Typography>
            <Typography>
              SQLCipher reads, offline mutation, applied and duplicate results, critical conflict,
              tombstone, cursor reset, process restart, explicit discard, and verified wipe
              completed.
            </Typography>
          </View>
        ) : null}
        {summary ? (
          <Typography selectable textRole="caption" tone="muted">
            {summary}
          </Typography>
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
    gap: theme.spacing.md,
    maxWidth: theme.layout.contentMaxWidth,
    paddingVertical: theme.spacing.lg,
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
}));

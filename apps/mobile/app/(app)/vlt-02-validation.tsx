import { createUuidV7 } from "@littlearc/domain";
import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { getRandomBytes } from "expo-crypto";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { getMobileEnvironment } from "../../src/bootstrap/environment";
import { Banner } from "../../src/components/ui/Banner";
import { Button } from "../../src/components/ui/Button";
import { Typography } from "../../src/components/ui/Typography";
import {
  enrollLocalSecurity,
  validateUnlockedLocalSecurity,
  wipeLocalSecurity,
  withUnlockedLocalDatabase,
} from "../../src/local-security/native";
import {
  buildConfirmedManualRecord,
  type ConfirmedManualRecord,
  emptyManualRecordForm,
  type ManualRecordFormValues,
  manualRecordFormFromProjection,
  parseManualRecordDraft,
} from "../../src/manual-records/form";
import { ManualRecordDetail } from "../../src/manual-records/ManualRecordDetail";
import { ManualRecordEditor } from "../../src/manual-records/ManualRecordEditor";
import { refreshRecordHistory, synchronizeManualRecords } from "../../src/manual-records/runtime";
import { synchronizationQueryOptions } from "../../src/sync/query";
import {
  deleteLocalRecordDraft,
  type LocalRecordProjection,
  listLocalRecordDrafts,
  queueRecordDelete,
  queueRecordUpsert,
  readLocalRecord,
  readLocalRecordVersions,
  saveLocalRecordDraft,
} from "../../src/sync/repository";

type Identifiers = {
  readonly childId: string;
  readonly householdId: string;
};

type Step =
  | "setup"
  | "draft"
  | "offline"
  | "categories"
  | "correct"
  | "detail"
  | "complete"
  | "working"
  | "error";

const validationHeaders = {
  "x-littlearc-synthetic-session": "vlt01-device-validation",
} as const;

const categoryForms: ReadonlyArray<ManualRecordFormValues> = [
  {
    ...emptyManualRecordForm("document"),
    documentKind: "Synthetic discharge summary",
    providerFacility: "Synthetic Clinic",
    title: "Synthetic manual document",
  },
  {
    ...emptyManualRecordForm("vaccination"),
    batchLot: "SYNTHETIC-LOT",
    eventDate: "2026-07-20",
    providerFacility: "Synthetic Clinic",
    title: "Synthetic manual vaccination",
    vaccinationDateMeaning: "given",
    vaccineName: "Synthetic vaccine",
  },
  {
    ...emptyManualRecordForm("doctor_visit"),
    eventDate: "2026-07-21",
    followUpDate: "2026-08-01",
    providerFacility: "Synthetic Clinic",
    reasonForVisit: "Synthetic routine visit",
    tags: "synthetic",
    title: "Synthetic manual doctor visit",
  },
];

const initialDraft = {
  ...emptyManualRecordForm("prescription"),
  medicines: "Synthetic medicine",
  providerFacility: "Synthetic Clinic",
  title: "Synthetic manual prescription",
  writtenSchedule: "Take exactly as written on the synthetic source.",
};

export default function Vlt02ValidationScreen() {
  const environment = getMobileEnvironment();
  const queryClient = useQueryClient();
  const deviceId = useMemo(() => createUuidV7(getRandomBytes(10)), []);
  const initialDraftId = useMemo(() => createUuidV7(getRandomBytes(10)), []);
  const [step, setStep] = useState<Step>("setup");
  const [identifiers, setIdentifiers] = useState<Identifiers>();
  const [draftId, setDraftId] = useState<string>(initialDraftId);
  const [draftForm, setDraftForm] = useState(initialDraft);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [recordIds, setRecordIds] = useState<ReadonlyArray<string>>([]);
  const [activeRecord, setActiveRecord] = useState<LocalRecordProjection>();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [summary, setSummary] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const { hostPhase } = useLocalSearchParams<{ hostPhase?: string }>();
  const completedHostPhase = useRef<string | undefined>(undefined);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the deep-link phase is the intentional trigger and the ref prevents repeats.
  useEffect(() => {
    if (!hostPhase || completedHostPhase.current === hostPhase) {
      return;
    }
    completedHostPhase.current = hostPhase;
    void runHostValidationPhase(hostPhase);
  }, [hostPhase]);

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  async function run(action: () => Promise<void>) {
    setStep("working");
    setErrorMessage(undefined);
    try {
      await action();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "VLT-02 validation failed.");
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
      throw new Error(`Synthetic VLT-02 request returned HTTP ${response.status}.`);
    }
    return response;
  }

  async function setApiAvailability(available: boolean) {
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

  async function confirmRecord(
    confirmed: ConfirmedManualRecord,
    targetDraftId: string,
    recordId: string,
    identifierOverride?: Identifiers,
  ) {
    const resolvedIdentifiers = identifierOverride ?? identifiers;
    if (!resolvedIdentifiers) {
      throw new Error("Synthetic identifiers are unavailable.");
    }
    await withUnlockedLocalDatabase((database) =>
      queueRecordUpsert(database, {
        ...confirmed,
        childId: resolvedIdentifiers.childId,
        draftId: targetDraftId,
        idempotencyKey: createUuidV7(getRandomBytes(10)),
        localDependencyIds: [],
        mutationId: createUuidV7(getRandomBytes(10)),
        now: new Date().toISOString(),
        recordId,
        sourceType: "manual",
      }),
    );
    await sync(resolvedIdentifiers.householdId);
    const record = await withUnlockedLocalDatabase((database) =>
      readLocalRecord(database, recordId),
    );
    if (record?.syncStatus !== "synced") {
      throw new Error("The manual record did not synchronize.");
    }
    return record;
  }

  async function runHostValidationPhase(phase: string) {
    if (phase === "prepare") {
      await run(async () => {
        await wipeLocalSecurity();
        await setApiAvailability(true);
        const bootstrap = (await (
          await request("/v1/validation/vlt01/bootstrap")
        ).json()) as Identifiers;
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
          throw new Error("SQLCipher schema V5 did not survive keyed reopen.");
        }
        await sync(bootstrap.householdId);
        await withUnlockedLocalDatabase((database) =>
          saveLocalRecordDraft(database, {
            category: initialDraft.category,
            childId: bootstrap.childId,
            draftId: initialDraftId,
            formJson: JSON.stringify(initialDraft),
            targetRecordId: null,
            updatedAt: new Date().toISOString(),
          }),
        );
        await setApiAvailability(false);
        setIdentifiers(bootstrap);
        setDraftForm(initialDraft);
        setDraftId(initialDraftId);
        setSummary("Host phase prepared · encrypted draft saved · API unavailable");
        setStep("offline");
      });
      return;
    }

    if (phase === "complete") {
      await run(async () => {
        const resumed = await withUnlockedLocalDatabase(async (database) => {
          const enrollment = await database.getFirstAsync<Identifiers>(
            `select
              household_id as "householdId",
              (select child_id from local_children where deleted_at is null limit 1)
                as "childId"
             from local_enrollment where singleton = 1`,
          );
          if (!enrollment?.childId) {
            throw new Error("The enrolled synthetic child is unavailable.");
          }
          const draft = (await listLocalRecordDrafts(database, enrollment.childId))[0];
          if (!draft) {
            throw new Error("No encrypted VLT-02 draft survived restart.");
          }
          return { draft, enrollment };
        });
        const connectivity = (await (
          await request("/v1/validation/vlt01/connectivity")
        ).json()) as { available: boolean };
        if (connectivity.available) {
          throw new Error("The synthetic API must remain unavailable during resume.");
        }
        const resumedForm = parseManualRecordDraft(resumed.draft.formJson, resumed.draft.category);
        await setApiAvailability(true);
        await confirmRecord(
          buildConfirmedManualRecord(resumedForm),
          resumed.draft.draftId,
          resumed.draft.draftId,
          resumed.enrollment,
        );

        let lastRecord: LocalRecordProjection | undefined;
        for (const form of categoryForms) {
          const recordId = createUuidV7(getRandomBytes(10));
          lastRecord = await confirmRecord(
            buildConfirmedManualRecord(form),
            recordId,
            recordId,
            resumed.enrollment,
          );
        }
        if (!lastRecord) {
          throw new Error("The synthetic category records were not created.");
        }

        const correction = buildConfirmedManualRecord({
          ...manualRecordFormFromProjection(lastRecord),
          notes: "Synthetic caregiver correction",
          title: `${lastRecord.content.title} corrected`,
        });
        const correctionDraftId = createUuidV7(getRandomBytes(10));
        const corrected = await confirmRecord(
          correction,
          correctionDraftId,
          lastRecord.recordId,
          resumed.enrollment,
        );
        await refreshRecordHistory(corrected.recordId, { headers: validationHeaders });
        const history = await withUnlockedLocalDatabase((database) =>
          readLocalRecordVersions(database, corrected.recordId),
        );
        if (history.length !== 2 || corrected.version !== 2) {
          throw new Error("Immutable correction history is incomplete.");
        }
        await withUnlockedLocalDatabase((database) =>
          queueRecordDelete(database, {
            idempotencyKey: createUuidV7(getRandomBytes(10)),
            mutationId: createUuidV7(getRandomBytes(10)),
            now: new Date().toISOString(),
            recordId: corrected.recordId,
          }),
        );
        await sync(resumed.enrollment.householdId);
        const deleted = await withUnlockedLocalDatabase((database) =>
          readLocalRecord(database, corrected.recordId),
        );
        if (deleted !== null) {
          throw new Error("The synchronized tombstone did not remove the local record.");
        }
        setIdentifiers(resumed.enrollment);
        setSummary(
          "VLT-02 validation passed · four categories · draft/restart · correction/history · delete",
        );
        setStep("complete");
      });
    }
  }

  const categoryForm = categoryForms[categoryIndex];
  const correctionForm = activeRecord
    ? {
        ...manualRecordFormFromProjection(activeRecord),
        notes: "Synthetic caregiver correction",
        title: `${activeRecord.content.title} corrected`,
      }
    : undefined;

  async function saveDraftForRestart(form: ManualRecordFormValues) {
    if (!identifiers) {
      throw new Error("Synthetic identifiers are unavailable.");
    }
    await withUnlockedLocalDatabase((database) =>
      saveLocalRecordDraft(database, {
        category: form.category,
        childId: identifiers.childId,
        draftId,
        formJson: JSON.stringify(form),
        targetRecordId: null,
        updatedAt: new Date().toISOString(),
      }),
    );
    await setApiAvailability(false);
    setDraftForm(form);
    setSummary("Draft encrypted locally · API unavailable · terminate and relaunch");
    setStep("offline");
  }

  async function confirmDraftRecord(confirmed: ConfirmedManualRecord) {
    await run(async () => {
      await setApiAvailability(true);
      const record = await confirmRecord(confirmed, draftId, draftId);
      setRecordIds([record.recordId]);
      setCategoryIndex(0);
      setSummary("Prescription confirmed and synchronized as version 1");
      setStep("categories");
    });
  }

  async function confirmCategoryRecord(confirmed: ConfirmedManualRecord) {
    await run(async () => {
      const recordId = createUuidV7(getRandomBytes(10));
      const record = await confirmRecord(confirmed, recordId, recordId);
      const nextIds = [...recordIds, record.recordId];
      setRecordIds(nextIds);
      if (categoryIndex + 1 < categoryForms.length) {
        setCategoryIndex(categoryIndex + 1);
        setSummary(`${record.content.title} synchronized as version 1`);
        setStep("categories");
      } else {
        setActiveRecord(record);
        setSummary("All four manual categories synchronized");
        setStep("correct");
      }
    });
  }

  async function confirmCorrection(confirmed: ConfirmedManualRecord) {
    if (!activeRecord) {
      throw new Error("The synthetic record to correct is unavailable.");
    }
    await run(async () => {
      const correctionDraftId = createUuidV7(getRandomBytes(10));
      const corrected = await confirmRecord(confirmed, correctionDraftId, activeRecord.recordId);
      await refreshRecordHistory(corrected.recordId, { headers: validationHeaders });
      const history = await withUnlockedLocalDatabase((database) =>
        readLocalRecordVersions(database, corrected.recordId),
      );
      if (history.length !== 2 || corrected.version !== 2) {
        throw new Error("Immutable correction history is incomplete.");
      }
      setActiveRecord(corrected);
      setSummary("Correction synchronized · two immutable versions cached");
      setStep("detail");
    });
  }

  async function deleteActiveRecord() {
    if (!activeRecord || !identifiers) {
      throw new Error("Synthetic record identifiers are unavailable.");
    }
    await run(async () => {
      const history = await refreshRecordHistory(activeRecord.recordId, {
        headers: validationHeaders,
      });
      if (history.length !== 2) {
        throw new Error("Two immutable versions were not available before deletion.");
      }
      await withUnlockedLocalDatabase((database) =>
        queueRecordDelete(database, {
          idempotencyKey: createUuidV7(getRandomBytes(10)),
          mutationId: createUuidV7(getRandomBytes(10)),
          now: new Date().toISOString(),
          recordId: activeRecord.recordId,
        }),
      );
      await sync(identifiers.householdId);
      const deleted = await withUnlockedLocalDatabase((database) =>
        readLocalRecord(database, activeRecord.recordId),
      );
      if (deleted !== null) {
        throw new Error("The synchronized tombstone did not remove the local record.");
      }
      setSummary(
        "VLT-02 validation passed · four categories · draft/restart · correction/history · delete",
      );
      setStep("complete");
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.content}>
        <Typography accessibilityRole="header" textRole="screenTitle">
          VLT-02 manual records
        </Typography>
        <Banner
          message="This development-only flow uses synthetic values and the production manual editor/detail components. It proves one physical device or Simulator only and does not close Gate 2."
          title="Synthetic evidence boundary"
          variant="warning"
        />

        {step === "setup" ? (
          <View style={styles.panel}>
            <Typography textRole="sectionTitle">1. Enroll and prepare a clean device</Typography>
            <Button
              label="Start clean VLT-02 flow"
              onPress={() =>
                void run(async () => {
                  await wipeLocalSecurity();
                  await setApiAvailability(true);
                  const bootstrap = (await (
                    await request("/v1/validation/vlt01/bootstrap")
                  ).json()) as Identifiers;
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
                    throw new Error("SQLCipher schema V5 did not survive keyed reopen.");
                  }
                  await sync(bootstrap.householdId);
                  setIdentifiers(bootstrap);
                  setDraftForm(initialDraft);
                  setDraftId(initialDraftId);
                  setSummary("SQLCipher schema V5 · production editor ready");
                  setStep("draft");
                })
              }
              testID="vlt02-start"
            />
            <Button
              label="Resume encrypted draft after restart"
              onPress={() =>
                void run(async () => {
                  const resumed = await withUnlockedLocalDatabase(async (database) => {
                    const enrollment = await database.getFirstAsync<Identifiers>(
                      `select
                        household_id as "householdId",
                        (select child_id from local_children where deleted_at is null limit 1)
                          as "childId"
                       from local_enrollment where singleton = 1`,
                    );
                    if (!enrollment?.childId) {
                      throw new Error("The enrolled synthetic child is unavailable.");
                    }
                    const draft = (await listLocalRecordDrafts(database, enrollment.childId))[0];
                    if (!draft) {
                      throw new Error("No encrypted VLT-02 draft survived restart.");
                    }
                    return { draft, enrollment };
                  });
                  const connectivity = (await (
                    await request("/v1/validation/vlt01/connectivity")
                  ).json()) as { available: boolean };
                  if (connectivity.available) {
                    throw new Error("The synthetic API must remain unavailable during resume.");
                  }
                  setIdentifiers(resumed.enrollment);
                  setDraftId(resumed.draft.draftId);
                  setDraftForm(
                    parseManualRecordDraft(resumed.draft.formJson, resumed.draft.category),
                  );
                  setSummary("Encrypted prescription draft reopened while API unavailable");
                  setStep("draft");
                })
              }
              testID="vlt02-resume"
              variant="secondary"
            />
          </View>
        ) : null}

        {step === "draft" && identifiers ? (
          <>
            <View style={styles.panel}>
              <Typography textRole="sectionTitle">Validation advance control</Typography>
              <Typography>
                This development-only control calls the same prefilled production-editor handler
                when host automation cannot reach controls below the fold.
              </Typography>
              <Button
                label={
                  summary?.includes("reopened")
                    ? "Confirm resumed prescription"
                    : "Save prefilled encrypted draft"
                }
                onPress={() => {
                  if (summary?.includes("reopened")) {
                    void confirmDraftRecord(buildConfirmedManualRecord(draftForm));
                    return;
                  }
                  void run(() => saveDraftForRestart(draftForm));
                }}
                testID="vlt02-advance-draft"
              />
            </View>
            <ManualRecordEditor
              key={`draft-${draftId}`}
              initial={draftForm}
              mode="create"
              onConfirm={confirmDraftRecord}
              onDiscard={async () => {
                await withUnlockedLocalDatabase((database) =>
                  deleteLocalRecordDraft(database, draftId),
                );
                setStep("setup");
              }}
              onSaveDraft={saveDraftForRestart}
            />
          </>
        ) : null}

        {step === "offline" ? (
          <View style={styles.panel}>
            <Typography textRole="sectionTitle">2. Offline process restart</Typography>
            <Typography>
              Terminate LittleArc, relaunch it, reopen this screen, and choose Resume encrypted
              draft after restart.
            </Typography>
          </View>
        ) : null}

        {step === "categories" && identifiers && categoryForm ? (
          <View style={styles.panel}>
            <Typography textRole="sectionTitle">
              {`3. Confirm ${categoryForm.category} with the production editor`}
            </Typography>
            <Button
              label={`Confirm prefilled ${categoryForm.category}`}
              onPress={() => void confirmCategoryRecord(buildConfirmedManualRecord(categoryForm))}
              testID="vlt02-advance-category"
            />
            <ManualRecordEditor
              key={`category-${categoryIndex}`}
              initial={categoryForm}
              mode="create"
              onConfirm={confirmCategoryRecord}
              onDiscard={async () => undefined}
              onSaveDraft={async () => undefined}
            />
          </View>
        ) : null}

        {step === "correct" && activeRecord && correctionForm ? (
          <>
            <View style={styles.panel}>
              <Typography textRole="sectionTitle">Validate immutable correction</Typography>
              <Button
                label="Confirm prefilled correction"
                onPress={() => void confirmCorrection(buildConfirmedManualRecord(correctionForm))}
                testID="vlt02-advance-correction"
              />
            </View>
            <ManualRecordEditor
              key="correction"
              initial={correctionForm}
              mode="correct"
              onConfirm={confirmCorrection}
              onDiscard={async () => setStep("detail")}
              onSaveDraft={async () => undefined}
            />
          </>
        ) : null}

        {step === "detail" && activeRecord ? (
          <>
            <View style={styles.panel}>
              <Typography textRole="sectionTitle">Validate history and deletion</Typography>
              <Button
                label="Verify history and delete prefilled record"
                onPress={() => void deleteActiveRecord()}
                testID="vlt02-advance-delete"
              />
            </View>
            <ManualRecordDetail
              deleting={confirmingDelete}
              onCorrect={() => setStep("correct")}
              onDelete={() => {
                if (!confirmingDelete) {
                  setConfirmingDelete(true);
                  return;
                }
                void deleteActiveRecord();
              }}
              onHistory={() => {
                void run(async () => {
                  const history = await refreshRecordHistory(activeRecord.recordId, {
                    headers: validationHeaders,
                  });
                  setSummary(`${history.length} immutable versions available`);
                  setStep("detail");
                });
              }}
              onSync={() => {
                void synchronizeManualRecords(queryClient, { headers: validationHeaders });
              }}
              record={activeRecord}
            />
          </>
        ) : null}

        {step === "working" ? (
          <Banner
            message="The current validation action is running."
            title="Working"
            variant="info"
          />
        ) : null}
        {step === "error" && errorMessage ? (
          <View style={styles.panel}>
            <Banner message={errorMessage} title="VLT-02 validation stopped" variant="danger" />
            <Button label="Return to setup" onPress={() => setStep("setup")} />
          </View>
        ) : null}
        {step === "complete" ? (
          <Banner
            message="The production manual components completed the encrypted draft/restart, four-category create, sync, detail, correction, history, and delete flow."
            title="VLT-02 device validation passed"
            variant="success"
          />
        ) : null}
        {summary ? (
          <View style={styles.summary}>
            <Typography textRole="caption" tone="muted">
              Latest evidence
            </Typography>
            <Typography selectable testID="vlt02-summary">
              {summary}
            </Typography>
          </View>
        ) : null}
      </View>
    </ScrollView>
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
    padding: theme.spacing.md,
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
    gap: theme.spacing.xxs,
    padding: theme.spacing.sm,
  },
}));

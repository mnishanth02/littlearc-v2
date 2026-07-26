import { createUuidV7 } from "@littlearc/domain";
import { useQueryClient } from "@tanstack/react-query";
import { getRandomBytes } from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Banner } from "../../../../src/components/ui/Banner";
import { withUnlockedLocalDatabase } from "../../../../src/local-security/native";
import {
  type ManualRecordFormValues,
  manualRecordFormFromProjection,
  parseManualRecordDraft,
} from "../../../../src/manual-records/form";
import { ManualRecordEditor } from "../../../../src/manual-records/ManualRecordEditor";
import { synchronizeManualRecords } from "../../../../src/manual-records/runtime";
import {
  deleteLocalRecordDraft,
  queueRecordUpsert,
  readLocalRecord,
  readLocalRecordDraft,
  saveLocalRecordDraft,
} from "../../../../src/sync/repository";

type EditorState =
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable" }
  | {
      readonly childId: string;
      readonly draftId: string;
      readonly initial: ManualRecordFormValues;
      readonly kind: "ready";
      readonly recordId: string;
    };

export default function CorrectManualRecordScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const parameters = useLocalSearchParams<{
    readonly draftId?: string | string[];
    readonly recordId?: string | string[];
  }>();
  const recordId = scalar(parameters.recordId);
  const requestedDraftId = scalar(parameters.draftId);
  const generatedDraftId = useMemo(() => createUuidV7(getRandomBytes(10)), []);
  const [state, setState] = useState<EditorState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    void loadEditor(recordId, requestedDraftId ?? generatedDraftId).then((next) => {
      if (active) {
        setState(next);
      }
    });
    return () => {
      active = false;
    };
  }, [generatedDraftId, recordId, requestedDraftId]);

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      {state.kind === "loading" ? (
        <Banner message="Unlocking the current record…" title="Loading" variant="info" />
      ) : null}
      {state.kind === "unavailable" ? (
        <Banner
          message="This record cannot be corrected from the local repository."
          title="Correction unavailable"
          variant="warning"
        />
      ) : null}
      {state.kind === "ready" ? (
        <ManualRecordEditor
          initial={state.initial}
          mode="correct"
          onConfirm={async (confirmed) => {
            await withUnlockedLocalDatabase((database) =>
              queueRecordUpsert(database, {
                ...confirmed,
                childId: state.childId,
                draftId: state.draftId,
                idempotencyKey: createUuidV7(getRandomBytes(10)),
                localDependencyIds: [],
                mutationId: createUuidV7(getRandomBytes(10)),
                now: new Date().toISOString(),
                recordId: state.recordId,
                sourceType: "manual",
              }),
            );
            await synchronizeManualRecords(queryClient);
            router.replace(`/records/${state.recordId}` as never);
          }}
          onDiscard={async () => {
            await withUnlockedLocalDatabase((database) =>
              deleteLocalRecordDraft(database, state.draftId),
            );
            router.back();
          }}
          onSaveDraft={async (form) => {
            await withUnlockedLocalDatabase((database) =>
              saveLocalRecordDraft(database, {
                category: form.category,
                childId: state.childId,
                draftId: state.draftId,
                formJson: JSON.stringify(form),
                targetRecordId: state.recordId,
                updatedAt: new Date().toISOString(),
              }),
            );
            if (!requestedDraftId) {
              router.setParams({ draftId: state.draftId });
            }
          }}
        />
      ) : null}
    </ScrollView>
  );
}

async function loadEditor(recordId: string | undefined, draftId: string): Promise<EditorState> {
  if (!recordId) {
    return { kind: "unavailable" };
  }
  return withUnlockedLocalDatabase(async (database) => {
    const record = await readLocalRecord(database, recordId);
    if (!record || record.deletedAt) {
      return { kind: "unavailable" };
    }
    const draft = await readLocalRecordDraft(database, draftId);
    return {
      childId: record.childId,
      draftId,
      initial: draft
        ? parseManualRecordDraft(draft.formJson, draft.category)
        : manualRecordFormFromProjection(record),
      kind: "ready",
      recordId,
    };
  });
}

function scalar(value: string | ReadonlyArray<string> | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

const styles = StyleSheet.create((theme) => ({
  shell: {
    alignItems: "center",
    backgroundColor: theme.colors.background.primary,
    flexGrow: 1,
    padding: theme.layout.screenPadding,
    paddingVertical: theme.spacing.lg,
  },
}));

import { createUuidV7 } from "@littlearc/domain";
import { useQueryClient } from "@tanstack/react-query";
import { getRandomBytes } from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Banner } from "../../../src/components/ui/Banner";
import { withUnlockedLocalDatabase } from "../../../src/local-security/native";
import {
  emptyManualRecordForm,
  type ManualRecordFormValues,
  parseManualRecordDraft,
} from "../../../src/manual-records/form";
import { ManualRecordEditor } from "../../../src/manual-records/ManualRecordEditor";
import { synchronizeManualRecords } from "../../../src/manual-records/runtime";
import {
  deleteLocalRecordDraft,
  queueRecordUpsert,
  readLocalRecordDraft,
  saveLocalRecordDraft,
} from "../../../src/sync/repository";

type EditorState =
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable" }
  | {
      readonly childId: string;
      readonly draftId: string;
      readonly initial: ManualRecordFormValues;
      readonly kind: "ready";
    };

export default function NewManualRecordScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const parameters = useLocalSearchParams<{ readonly draftId?: string | string[] }>();
  const generatedDraftId = useMemo(() => createUuidV7(getRandomBytes(10)), []);
  const requestedDraftId = scalar(parameters.draftId);
  const [state, setState] = useState<EditorState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    void loadEditor(requestedDraftId ?? generatedDraftId).then((next) => {
      if (active) {
        setState(next);
      }
    });
    return () => {
      active = false;
    };
  }, [generatedDraftId, requestedDraftId]);

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      {state.kind === "loading" ? (
        <Banner message="Unlocking the encrypted draft…" title="Loading" variant="info" />
      ) : null}
      {state.kind === "unavailable" ? (
        <Banner
          message="An enrolled local child profile is required before record creation."
          title="Record unavailable"
          variant="warning"
        />
      ) : null}
      {state.kind === "ready" ? (
        <ManualRecordEditor
          initial={state.initial}
          mode="create"
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
                recordId: state.draftId,
                sourceType: "manual",
              }),
            );
            await synchronizeManualRecords(queryClient);
            router.replace(`/records/${state.draftId}` as never);
          }}
          onDiscard={async () => {
            await withUnlockedLocalDatabase((database) =>
              deleteLocalRecordDraft(database, state.draftId),
            );
            router.back();
          }}
          onSaveDraft={async (form) => {
            await persistDraft(state.draftId, state.childId, form);
            if (!requestedDraftId) {
              router.setParams({ draftId: state.draftId });
            }
          }}
        />
      ) : null}
    </ScrollView>
  );
}

async function loadEditor(draftId: string): Promise<EditorState> {
  return withUnlockedLocalDatabase(async (database) => {
    const child = await database.getFirstAsync<{ readonly childId: string }>(
      `select child_id as "childId" from local_children
       where deleted_at is null order by child_id limit 1`,
    );
    if (!child) {
      return { kind: "unavailable" };
    }
    const draft = await readLocalRecordDraft(database, draftId);
    return {
      childId: child.childId,
      draftId,
      initial: draft
        ? parseManualRecordDraft(draft.formJson, draft.category)
        : emptyManualRecordForm(),
      kind: "ready",
    };
  });
}

async function persistDraft(
  draftId: string,
  childId: string,
  form: ManualRecordFormValues,
): Promise<void> {
  await withUnlockedLocalDatabase((database) =>
    saveLocalRecordDraft(database, {
      category: form.category,
      childId,
      draftId,
      formJson: JSON.stringify(form),
      targetRecordId: null,
      updatedAt: new Date().toISOString(),
    }),
  );
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

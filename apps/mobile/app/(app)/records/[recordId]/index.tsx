import { createUuidV7 } from "@littlearc/domain";
import { useQueryClient } from "@tanstack/react-query";
import { getRandomBytes } from "expo-crypto";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Banner } from "../../../../src/components/ui/Banner";
import { withUnlockedLocalDatabase } from "../../../../src/local-security/native";
import { ManualRecordDetail } from "../../../../src/manual-records/ManualRecordDetail";
import { synchronizeManualRecords } from "../../../../src/manual-records/runtime";
import {
  type LocalRecordProjection,
  queueRecordDelete,
  readLocalRecord,
} from "../../../../src/sync/repository";

type State =
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "ready"; readonly record: LocalRecordProjection };

export default function ManualRecordDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const parameters = useLocalSearchParams<{ readonly recordId?: string | string[] }>();
  const recordId = scalar(parameters.recordId);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const reload = useCallback(async () => {
    if (!recordId) {
      setState({ kind: "unavailable" });
      return;
    }
    const record = await withUnlockedLocalDatabase((database) =>
      readLocalRecord(database, recordId),
    );
    setState(record && !record.deletedAt ? { kind: "ready", record } : { kind: "unavailable" });
  }, [recordId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      {state.kind === "loading" ? (
        <Banner message="Unlocking the encrypted record…" title="Loading" variant="info" />
      ) : null}
      {state.kind === "unavailable" ? (
        <Banner
          message="This record is unavailable or has been deleted."
          title="Record unavailable"
          variant="warning"
        />
      ) : null}
      {state.kind === "ready" ? (
        <ManualRecordDetail
          deleting={confirmingDelete}
          onCorrect={() => router.push(`/records/${state.record.recordId}/edit` as never)}
          onDelete={() => {
            if (!confirmingDelete) {
              setConfirmingDelete(true);
              return;
            }
            void (async () => {
              await withUnlockedLocalDatabase((database) =>
                queueRecordDelete(database, {
                  idempotencyKey: createUuidV7(getRandomBytes(10)),
                  mutationId: createUuidV7(getRandomBytes(10)),
                  now: new Date().toISOString(),
                  recordId: state.record.recordId,
                }),
              );
              await synchronizeManualRecords(queryClient);
              router.replace("/records");
            })();
          }}
          onHistory={() => router.push(`/records/${state.record.recordId}/history` as never)}
          onSync={() => {
            void synchronizeManualRecords(queryClient).then(reload);
          }}
          record={state.record}
        />
      ) : null}
    </ScrollView>
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

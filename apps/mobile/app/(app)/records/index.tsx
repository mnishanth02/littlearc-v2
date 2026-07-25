import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { type LocalCaptureDraft, listCaptureDrafts } from "../../../src/capture/repository";
import { Banner } from "../../../src/components/ui/Banner";
import { Button } from "../../../src/components/ui/Button";
import { Typography } from "../../../src/components/ui/Typography";
import { withUnlockedLocalDatabase } from "../../../src/local-security/native";
import { manualRecordCategoryLabel } from "../../../src/manual-records/form";
import {
  type LocalRecordDraft,
  type LocalRecordProjection,
  listLocalManualRecords,
  listLocalRecordDrafts,
} from "../../../src/sync/repository";

type ScreenState =
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable" }
  | {
      readonly drafts: ReadonlyArray<LocalRecordDraft>;
      readonly captureDrafts: ReadonlyArray<LocalCaptureDraft>;
      readonly kind: "ready";
      readonly records: ReadonlyArray<LocalRecordProjection>;
    };

export default function ManualRecordsScreen() {
  const router = useRouter();
  const [state, setState] = useState<ScreenState>({ kind: "loading" });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadRecords().then((next) => {
        if (active) {
          setState(next);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.content}>
        <Typography accessibilityRole="header" textRole="display">
          Manual records
        </Typography>
        <Banner
          message="Create manual records or keep encrypted capture sources on this device. Upload, OCR, attachments, search, and full Vault browsing arrive in later packages."
          title="Bounded record management"
          variant="info"
        />
        <Button
          label="Capture or import source"
          onPress={() => router.push("/capture")}
          testID="record-capture"
        />
        <Button
          label="Add manual record"
          onPress={() => router.push("/records/new")}
          testID="record-add"
        />
        {state.kind === "loading" ? (
          <Banner message="Unlocking encrypted records…" title="Loading" variant="info" />
        ) : null}
        {state.kind === "unavailable" ? (
          <Banner
            message="An enrolled local child profile is required before manual record creation."
            title="Records unavailable"
            variant="warning"
          />
        ) : null}
        {state.kind === "ready" ? (
          <>
            <Typography accessibilityRole="header" textRole="sectionTitle">
              Capture drafts
            </Typography>
            {state.captureDrafts.length === 0 ? (
              <Typography tone="muted">No protected capture drafts on this device.</Typography>
            ) : (
              state.captureDrafts.map((draft) => (
                <Button
                  key={draft.draftId}
                  label={`Capture draft · ${draft.assets.length} sources · ${draft.updatedAt.slice(0, 10)}`}
                  onPress={() => router.push(`/capture?draftId=${draft.draftId}` as never)}
                  testID={`capture-draft-${draft.draftId}`}
                  variant="secondary"
                />
              ))
            )}
            <Typography accessibilityRole="header" textRole="sectionTitle">
              Saved drafts
            </Typography>
            {state.drafts.length === 0 ? (
              <Typography tone="muted">No encrypted drafts on this device.</Typography>
            ) : (
              state.drafts.map((draft) => (
                <Button
                  key={draft.draftId}
                  label={`${manualRecordCategoryLabel(draft.category)} draft · ${draft.updatedAt.slice(0, 10)}`}
                  onPress={() =>
                    router.push(
                      draft.targetRecordId
                        ? (`/records/${draft.targetRecordId}/edit?draftId=${draft.draftId}` as never)
                        : (`/records/new?draftId=${draft.draftId}` as never),
                    )
                  }
                  testID={`record-draft-${draft.draftId}`}
                  variant="secondary"
                />
              ))
            )}
            <Typography accessibilityRole="header" textRole="sectionTitle">
              Confirmed records
            </Typography>
            {state.records.length === 0 ? (
              <Typography tone="muted">No confirmed manual records on this device.</Typography>
            ) : (
              state.records.map((record) => (
                <Button
                  key={record.recordId}
                  label={`${record.content.title} · ${record.syncStatus}`}
                  onPress={() => router.push(`/records/${record.recordId}` as never)}
                  testID={`record-open-${record.recordId}`}
                  variant="secondary"
                />
              ))
            )}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

async function loadRecords(): Promise<ScreenState> {
  return withUnlockedLocalDatabase(async (database) => {
    const child = await database.getFirstAsync<{ readonly childId: string }>(
      `select child_id as "childId" from local_children
       where deleted_at is null order by child_id limit 1`,
    );
    if (!child) {
      return { kind: "unavailable" };
    }
    const [captureDrafts, drafts, records] = await Promise.all([
      listCaptureDrafts(database, child.childId),
      listLocalRecordDrafts(database, child.childId),
      listLocalManualRecords(database, child.childId),
    ]);
    return { captureDrafts, drafts, kind: "ready", records };
  });
}

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.spacing.lg,
    maxWidth: theme.layout.contentMaxWidth,
    width: "100%",
  },
  shell: {
    alignItems: "center",
    backgroundColor: theme.colors.background.primary,
    flexGrow: 1,
    padding: theme.layout.screenPadding,
    paddingVertical: theme.spacing.lg,
  },
}));

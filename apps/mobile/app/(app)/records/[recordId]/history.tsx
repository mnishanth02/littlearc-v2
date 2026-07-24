import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Banner } from "../../../../src/components/ui/Banner";
import { Typography } from "../../../../src/components/ui/Typography";
import { withUnlockedLocalDatabase } from "../../../../src/local-security/native";
import { versionSummary } from "../../../../src/manual-records/presentation";
import { refreshRecordHistory } from "../../../../src/manual-records/runtime";
import {
  type RecordVersionProjection,
  readLocalRecordVersions,
} from "../../../../src/sync/repository";

export default function ManualRecordHistoryScreen() {
  const parameters = useLocalSearchParams<{ readonly recordId?: string | string[] }>();
  const recordId = scalar(parameters.recordId);
  const [versions, setVersions] = useState<ReadonlyArray<RecordVersionProjection>>([]);
  const [offline, setOffline] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!recordId) {
        return;
      }
      void (async () => {
        const cached = await withUnlockedLocalDatabase((database) =>
          readLocalRecordVersions(database, recordId),
        );
        if (active) {
          setVersions(cached);
        }
        try {
          const refreshed = await refreshRecordHistory(recordId);
          if (active) {
            setVersions(refreshed);
            setOffline(false);
          }
        } catch {
          if (active) {
            setOffline(true);
          }
        }
      })();
      return () => {
        active = false;
      };
    }, [recordId]),
  );

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.content}>
        {offline ? (
          <Banner
            message="Showing immutable versions already cached on this device."
            title="Offline history"
            variant="info"
          />
        ) : null}
        {versions.length === 0 ? (
          <Banner
            message="No cached version history is available yet. Connect and synchronize the record first."
            title="History unavailable"
            variant="warning"
          />
        ) : (
          versions.map((version) => (
            <View key={version.versionId} style={styles.card}>
              <Typography accessibilityRole="header" textRole="sectionTitle">
                {versionSummary(version)}
              </Typography>
              <Typography selectable>{version.content.title}</Typography>
              <Typography tone="muted">Source: {version.provenance.sourceType}</Typography>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function scalar(value: string | ReadonlyArray<string> | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.background.elevated,
    borderColor: theme.colors.border.default,
    borderCurve: "continuous",
    borderRadius: theme.radii.card,
    borderWidth: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  content: {
    gap: theme.spacing.md,
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

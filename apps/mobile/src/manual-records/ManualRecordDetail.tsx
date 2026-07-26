import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { Typography } from "../components/ui/Typography";
import type { LocalRecordProjection } from "../sync/repository";
import { recordDateLabel, recordFieldRows, recordStatusLabel } from "./presentation";

export function ManualRecordDetail(props: {
  readonly deleting: boolean;
  readonly onCorrect: () => void;
  readonly onDelete: () => void;
  readonly onHistory: () => void;
  readonly onSync: () => void;
  readonly record: LocalRecordProjection;
}) {
  return (
    <View style={styles.content}>
      <Banner
        message={recordStatusLabel(props.record)}
        title="Record status"
        variant={
          props.record.syncStatus === "synced"
            ? "success"
            : props.record.syncStatus === "conflict" || props.record.syncStatus === "rejected"
              ? "warning"
              : "info"
        }
      />
      <View accessibilityLabel="Confirmed record fields" style={styles.card}>
        {recordFieldRows(props.record).map((row) => (
          <View key={row.label} style={styles.row}>
            <Typography textRole="caption" tone="muted">
              {row.label}
            </Typography>
            <Typography selectable>{row.value}</Typography>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Typography>{recordDateLabel(props.record)}</Typography>
        <Typography>Source: Manual entry</Typography>
        <Typography>
          Version {props.record.version} · revision {props.record.revision}
        </Typography>
      </View>
      <Banner
        message="A correction creates a new immutable version. Deletion removes this record from the app immediately and queues server deletion; hard-purge timing is not promised here."
        title="History and deletion"
        variant="warning"
      />
      <View style={styles.actions}>
        <Button label="Sync now" onPress={props.onSync} testID="record-sync-now" />
        <Button
          label="Correct record"
          onPress={props.onCorrect}
          testID="record-correct"
          variant="secondary"
        />
        <Button
          label="View version history"
          onPress={props.onHistory}
          testID="record-history"
          variant="secondary"
        />
        <Button
          label={props.deleting ? "Confirm delete record" : "Delete record"}
          onPress={props.onDelete}
          testID={props.deleting ? "record-confirm-delete" : "record-delete"}
          variant="secondary"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  actions: {
    gap: theme.spacing.xs,
  },
  card: {
    backgroundColor: theme.colors.background.elevated,
    borderColor: theme.colors.border.default,
    borderCurve: "continuous",
    borderRadius: theme.radii.card,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  content: {
    gap: theme.spacing.lg,
    maxWidth: theme.layout.contentMaxWidth,
    width: "100%",
  },
  row: {
    gap: theme.spacing.xxs,
  },
}));

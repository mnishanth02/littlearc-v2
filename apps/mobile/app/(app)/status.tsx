import { ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { getMobileEnvironment } from "../../src/bootstrap/environment";
import { Banner } from "../../src/components/ui/Banner";
import { Typography } from "../../src/components/ui/Typography";

const runtimeChecks = [
  { label: "Expo development client", status: "Configured" },
  { label: "Expo Router groups", status: "Configured" },
  { label: "SQLCipher plugin", status: "Configured" },
  { label: "Scanner and OCR modules", status: "Configured" },
  { label: "Gate 1 Android physical device", status: "Accepted" },
  { label: "Broader pre-pilot device matrix", status: "Deferred" },
] as const;

export default function RuntimeStatusScreen() {
  const environment = getMobileEnvironment();

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.content}>
        <Typography accessibilityRole="header" textRole="screenTitle">
          Runtime status
        </Typography>
        <Banner
          message="The mobile shell is configured for synthetic local work. Physical-device acceptance remains a named later gate."
          title="Foundation configured"
          variant="success"
        />
        <View style={styles.statusPanel}>
          <Typography textRole="caption" tone="muted">
            Environment
          </Typography>
          <Typography selectable textRole="bodyEmphasis">
            {environment.appEnv}
          </Typography>
          <Typography textRole="caption" tone="muted">
            API origin
          </Typography>
          <Typography selectable>{environment.apiBaseUrl}</Typography>
        </View>
        <View accessibilityLabel="Mobile runtime checks" style={styles.checkList}>
          {runtimeChecks.map((check) => (
            <View key={check.label} style={styles.checkRow}>
              <Typography style={styles.checkLabel}>{check.label}</Typography>
              <Typography
                textRole="label"
                tone={check.status === "Deferred" ? "secondary" : "primary"}
              >
                {check.status}
              </Typography>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
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
    width: "100%",
  },
  statusPanel: {
    backgroundColor: theme.colors.background.elevated,
    borderColor: theme.colors.border.default,
    borderCurve: "continuous",
    borderRadius: theme.radii.card,
    borderWidth: 1,
    gap: theme.spacing.xxs,
    padding: theme.spacing.md,
  },
  checkList: {
    gap: theme.spacing.xs,
  },
  checkRow: {
    alignItems: "center",
    backgroundColor: theme.colors.background.elevated,
    borderColor: theme.colors.border.default,
    borderCurve: "continuous",
    borderRadius: theme.radii.control,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    minHeight: theme.touchTargets.minimum,
    padding: theme.spacing.sm,
  },
  checkLabel: {
    flex: 1,
  },
}));

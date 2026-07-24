import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { getMobileEnvironment } from "../../src/bootstrap/environment";
import { Banner } from "../../src/components/ui/Banner";
import { Button } from "../../src/components/ui/Button";
import { Typography } from "../../src/components/ui/Typography";

const landingSteps = [
  "Create a parent account",
  "Add one synthetic child profile",
  "Open emergency information offline",
] as const;

export default function LandingScreen() {
  const environment = getMobileEnvironment();
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.content}>
        <View style={styles.heading}>
          <Typography accessibilityRole="header" textRole="display">
            LittleArc
          </Typography>
          <Typography textRole="bodyEmphasis" tone="secondary">
            A calm, offline-first place for a family&apos;s pediatric history.
          </Typography>
        </View>

        <Banner
          message="This foundation environment uses synthetic fixtures only. Real child and participant data remains blocked."
          title="M1 engineering workspace"
          variant="info"
        />

        <View accessibilityLabel="Synthetic landing flow" style={styles.stepList}>
          {landingSteps.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Typography align="center" textRole="bodyEmphasis">
                  {index + 1}
                </Typography>
              </View>
              <Typography style={styles.stepText}>{step}</Typography>
            </View>
          ))}
        </View>

        <View accessibilityLabel="Current runtime environment" style={styles.statusPanel}>
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

        <View style={styles.actions}>
          <Button
            label="Open emergency card"
            onPress={() => router.push("/emergency")}
            testID="open-emergency-card"
          />
          <Button label="Open runtime status" onPress={() => router.push("/status")} />
          {__DEV__ ? (
            <>
              <Button
                label="Start OFF-06 synthetic onboarding"
                onPress={() => router.push("/onboarding")}
                testID="open-off06-onboarding"
                variant="secondary"
              />
              <Button
                label="Open OFF-01 device validation"
                onPress={() => router.push("/off-01-validation")}
                testID="open-off01-validation"
                variant="secondary"
              />
              <Button
                label="Open OFF-02 synthetic onboarding"
                onPress={() => router.push("/off-02-validation")}
                testID="open-off02-validation"
                variant="secondary"
              />
              <Button
                label="Open OFF-03 local-security validation"
                onPress={() => router.push("/off-03-validation")}
                testID="open-off03-validation"
                variant="secondary"
              />
              <Button
                label="Open OFF-04 repository validation"
                onPress={() => router.push("/off-04-validation")}
                testID="open-off04-validation"
                variant="secondary"
              />
              <Button
                label="Open OFF-05 emergency-card validation"
                onPress={() => router.push("/off-05-validation")}
                testID="open-off05-validation"
                variant="secondary"
              />
              <Button
                label="Open design-system gallery"
                onPress={() => router.push("/design-system")}
                variant="secondary"
              />
            </>
          ) : null}
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
    justifyContent: "center",
    padding: theme.layout.screenPadding,
  },
  content: {
    gap: theme.spacing.lg,
    maxWidth: theme.layout.contentMaxWidth,
    paddingVertical: theme.spacing.xl,
    width: "100%",
  },
  heading: {
    gap: theme.spacing.xs,
  },
  stepList: {
    gap: theme.spacing.sm,
  },
  stepNumber: {
    alignItems: "center",
    backgroundColor: theme.colors.record.confirmed,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: theme.touchTargets.minimum,
    minWidth: theme.touchTargets.minimum,
  },
  stepRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  stepText: {
    flex: 1,
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
  actions: {
    gap: theme.spacing.xs,
  },
}));

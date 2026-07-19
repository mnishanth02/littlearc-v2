import { Redirect } from "expo-router";
import { ScrollView, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Banner, type BannerVariant } from "../../src/components/ui/Banner";
import { Button, type ButtonVariant } from "../../src/components/ui/Button";
import { Typography } from "../../src/components/ui/Typography";
import { useDesignSystemPreferences } from "../../src/theme/unistyles";

const typographySamples = [
  ["display", "A calm family archive"],
  ["screenTitle", "Screen title that can wrap onto another line"],
  ["sectionTitle", "Section title"],
  ["cardTitle", "Card title"],
  ["body", "Body copy remains readable and grows vertically with the system text size."],
  ["bodyEmphasis", "Important confirmed fact"],
  ["metadata", "Source and date metadata"],
  ["label", "Control label"],
  ["caption", "Supporting caption; never the only critical information."],
  ["monospace", "LA-SUPPORT-001"],
] as const;

const buttonVariants: readonly ButtonVariant[] = ["primary", "secondary", "quiet", "destructive"];
const bannerVariants: readonly BannerVariant[] = [
  "info",
  "success",
  "attention",
  "warning",
  "danger",
  "offline",
];

export default function DesignSystemGallery() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <DevelopmentGallery />;
}

function DevelopmentGallery() {
  const preferences = useDesignSystemPreferences();
  const { rt } = useUnistyles();

  return (
    <ScrollView contentContainerStyle={styles.shell} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.content}>
        <Typography accessibilityRole="header" textRole="screenTitle">
          Design-system gallery
        </Typography>
        <Typography tone="secondary">
          Development-only synthetic reference for semantic themes, scalable type, state labels, and
          accessible targets.
        </Typography>

        <View style={styles.preferencePanel}>
          <Typography textRole="sectionTitle">Preferences</Typography>
          <Typography selectable>Theme: {rt.themeName ?? "system"}</Typography>
          <Typography selectable>
            High contrast: {preferences.highContrast ? "Enabled" : "Not enabled"}
          </Typography>
          <Typography selectable>
            Reduced motion: {preferences.reduceMotion ? "Enabled" : "Not enabled"}
          </Typography>
          <Typography selectable>Font scale: {rt.fontScale.toFixed(2)}</Typography>
        </View>

        <View style={styles.section}>
          <Typography textRole="sectionTitle">Typography</Typography>
          {typographySamples.map(([role, sample]) => (
            <Typography key={role} textRole={role}>
              {sample}
            </Typography>
          ))}
        </View>

        <View style={styles.section}>
          <Typography textRole="sectionTitle">Actions</Typography>
          {buttonVariants.map((variant) => (
            <Button key={variant} label={`${variant} action`} variant={variant} />
          ))}
          <Button disabled label="Disabled action" />
          <Button label="Saving" loading />
        </View>

        <View style={styles.section}>
          <Typography textRole="sectionTitle">Feedback states</Typography>
          {bannerVariants.map((variant) => (
            <Banner
              key={variant}
              message="The state and next step are written explicitly, so color is never the only signal."
              title={`${variant} state`}
              variant={variant}
            />
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
    gap: theme.spacing.xl,
    maxWidth: theme.layout.contentMaxWidth,
    width: "100%",
  },
  preferencePanel: {
    backgroundColor: theme.colors.background.elevated,
    borderColor: theme.colors.border.default,
    borderCurve: "continuous",
    borderRadius: theme.radii.card,
    borderWidth: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  section: {
    gap: theme.spacing.sm,
  },
}));

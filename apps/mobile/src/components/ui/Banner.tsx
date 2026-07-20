import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Button } from "./Button";
import { Typography } from "./Typography";

export type BannerVariant = "info" | "success" | "attention" | "warning" | "danger" | "offline";

export type BannerProps = {
  readonly title: string;
  readonly message: string;
  readonly variant?: BannerVariant;
  readonly actionLabel?: string;
  readonly onActionPress?: () => void;
};

const stateLabels: Record<BannerVariant, string> = {
  info: "Information",
  success: "Completed",
  attention: "Needs attention",
  warning: "Warning",
  danger: "Action required",
  offline: "Offline",
};

export function Banner({
  title,
  message,
  variant = "info",
  actionLabel,
  onActionPress,
}: BannerProps) {
  return (
    <View
      accessibilityLabel={`${stateLabels[variant]}: ${title}. ${message}`}
      accessibilityRole={variant === "danger" || variant === "warning" ? "alert" : "summary"}
      style={[styles.base, styles[variant]]}
    >
      <Typography textRole="caption">{stateLabels[variant]}</Typography>
      <Typography textRole="bodyEmphasis">{title}</Typography>
      <Typography>{message}</Typography>
      {actionLabel && onActionPress ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onActionPress} variant="quiet" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: {
    borderCurve: "continuous",
    borderColor: theme.colors.border.strong,
    borderRadius: theme.radii.card,
    borderWidth: 2,
    gap: theme.spacing.xxs,
    padding: theme.spacing.md,
  },
  info: { backgroundColor: theme.colors.status.info },
  success: { backgroundColor: theme.colors.status.success },
  attention: { backgroundColor: theme.colors.status.attention },
  warning: { backgroundColor: theme.colors.status.warning },
  danger: {
    backgroundColor: theme.colors.status.danger,
    borderColor: theme.colors.border.destructive,
  },
  offline: { backgroundColor: theme.colors.status.offline },
  action: {
    alignSelf: "flex-start",
    paddingTop: theme.spacing.xs,
  },
}));

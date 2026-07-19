import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, type PressableProps, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Typography, type TypographyTone } from "./Typography";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "destructive";

export type ButtonProps = Omit<PressableProps, "children"> & {
  readonly label: string;
  readonly variant?: ButtonVariant;
  readonly loading?: boolean;
  readonly leading?: ReactNode;
};

const labelTones: Record<ButtonVariant, TypographyTone> = {
  primary: "inverse",
  secondary: "primary",
  quiet: "primary",
  destructive: "inverse",
};

export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled = false,
  leading,
  accessibilityLabel,
  ...props
}: ButtonProps) {
  const { theme } = useUnistyles();
  const inactive = disabled || loading;
  const indicatorColor =
    variant === "primary" || variant === "destructive"
      ? theme.colors.text.inverse
      : theme.colors.text.primary;

  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: inactive }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !inactive && styles[`${variant}Pressed`],
        inactive && styles.disabled,
      ]}
    >
      <View style={styles.content}>
        {loading ? <ActivityIndicator color={indicatorColor} size="small" /> : leading}
        <Typography textRole="label" tone={inactive ? "disabled" : labelTones[variant]}>
          {loading ? `${label}, in progress` : label}
        </Typography>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: theme.radii.control,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: theme.touchTargets.minimum,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
    justifyContent: "center",
  },
  primary: {
    backgroundColor: theme.colors.action.primary,
    borderColor: theme.colors.action.primary,
  },
  primaryPressed: {
    backgroundColor: theme.colors.action.primaryPressed,
    borderColor: theme.colors.action.primaryPressed,
  },
  secondary: {
    backgroundColor: theme.colors.action.secondary,
    borderColor: theme.colors.border.default,
  },
  secondaryPressed: {
    backgroundColor: theme.colors.action.secondaryPressed,
    borderColor: theme.colors.border.strong,
  },
  quiet: {
    backgroundColor: theme.colors.background.elevated,
    borderColor: theme.colors.border.strong,
  },
  quietPressed: {
    backgroundColor: theme.colors.background.secondary,
    borderColor: theme.colors.border.focus,
  },
  destructive: {
    backgroundColor: theme.colors.action.destructive,
    borderColor: theme.colors.action.destructive,
  },
  destructivePressed: {
    backgroundColor: theme.colors.action.destructivePressed,
    borderColor: theme.colors.action.destructivePressed,
  },
  disabled: {
    backgroundColor: theme.colors.action.disabled,
    borderColor: theme.colors.border.subtle,
  },
}));

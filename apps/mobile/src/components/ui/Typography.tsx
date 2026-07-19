import type { TypographyRole } from "@littlearc/design-tokens";
import type { ReactNode } from "react";
import { Text, type TextProps } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export type TypographyTone = "primary" | "secondary" | "muted" | "inverse" | "disabled" | "link";

export type TypographyProps = TextProps & {
  readonly children: ReactNode;
  readonly textRole?: TypographyRole;
  readonly tone?: TypographyTone;
  readonly align?: "left" | "center" | "right";
};

export function Typography({
  children,
  textRole = "body",
  tone = "primary",
  align = "left",
  style,
  ...props
}: TypographyProps) {
  return (
    <Text
      {...props}
      allowFontScaling
      selectable={props.selectable ?? false}
      style={[styles[textRole], styles[tone], styles[align], style]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create((theme) => ({
  display: theme.typography.display,
  screenTitle: theme.typography.screenTitle,
  sectionTitle: theme.typography.sectionTitle,
  cardTitle: theme.typography.cardTitle,
  body: theme.typography.body,
  bodyEmphasis: theme.typography.bodyEmphasis,
  metadata: theme.typography.metadata,
  label: theme.typography.label,
  caption: theme.typography.caption,
  monospace: theme.typography.monospace,
  primary: { color: theme.colors.text.primary },
  secondary: { color: theme.colors.text.secondary },
  muted: { color: theme.colors.text.muted },
  inverse: { color: theme.colors.text.inverse },
  disabled: { color: theme.colors.text.disabled },
  link: { color: theme.colors.text.link },
  left: { textAlign: "left" },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
}));

import {
  breakpoints,
  darkColors,
  highContrastColors,
  layout,
  lightColors,
  motion,
  radii,
  spacing,
  touchTargets,
  typography,
} from "@littlearc/design-tokens";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Appearance, useColorScheme } from "react-native";
import { StyleSheet, UnistylesRuntime } from "react-native-unistyles";

const sharedTheme = {
  typography,
  spacing,
  radii,
  touchTargets,
  layout,
  motion,
} as const;

export const appThemes = {
  light: {
    colors: lightColors,
    ...sharedTheme,
  },
  dark: {
    colors: darkColors,
    ...sharedTheme,
  },
  highContrast: {
    colors: highContrastColors,
    ...sharedTheme,
  },
} as const;

type AppThemes = typeof appThemes;
type AppBreakpoints = typeof breakpoints;

declare module "react-native-unistyles" {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  themes: appThemes,
  breakpoints,
  settings: {
    initialTheme: () => (Appearance.getColorScheme() === "dark" ? "dark" : "light"),
  },
});

export type DesignSystemPreferences = {
  readonly highContrast: boolean;
  readonly reduceMotion: boolean;
};

export function useDesignSystemPreferences(): DesignSystemPreferences {
  const colorScheme = useColorScheme();
  const [highContrast, setHighContrast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    const usesIosContrastSignal = process.env.EXPO_OS === "ios";
    const highContrastQuery = usesIosContrastSignal
      ? AccessibilityInfo.isDarkerSystemColorsEnabled()
      : AccessibilityInfo.isHighTextContrastEnabled();

    void Promise.all([highContrastQuery, AccessibilityInfo.isReduceMotionEnabled()]).then(
      ([systemHighContrast, reduced]) => {
        if (!active) {
          return;
        }
        setHighContrast(systemHighContrast);
        setReduceMotion(reduced);
      },
    );

    const highContrastSubscription = AccessibilityInfo.addEventListener(
      usesIosContrastSignal ? "darkerSystemColorsChanged" : "highTextContrastChanged",
      setHighContrast,
    );
    const reduceMotionSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );

    return () => {
      active = false;
      highContrastSubscription.remove();
      reduceMotionSubscription.remove();
    };
  }, []);

  useEffect(() => {
    UnistylesRuntime.setTheme(
      highContrast ? "highContrast" : colorScheme === "dark" ? "dark" : "light",
    );
  }, [colorScheme, highContrast]);

  return { highContrast, reduceMotion };
}

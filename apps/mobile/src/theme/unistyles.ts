import { StyleSheet } from 'react-native-unistyles';
import { 
  lightColors, 
  darkColors, 
  highContrastColors,
  typography,
  spacing,
  radii,
  breakpoints,
  touchTargets,
  layout
} from '@littlearc/design-tokens';

const sharedThemeOptions = {
  typography,
  spacing,
  radii,
  touchTargets,
  layout,
};

export const lightTheme = {
  colors: lightColors,
  ...sharedThemeOptions,
} as const;

export const darkTheme = {
  colors: darkColors,
  ...sharedThemeOptions,
} as const;

export const highContrastTheme = {
  colors: highContrastColors,
  ...sharedThemeOptions,
} as const;

const appThemes = {
  light: lightTheme,
  dark: darkTheme,
  highContrast: highContrastTheme,
};

StyleSheet.configure({
  settings: {
    adaptiveThemes: true, // Automatically adapt based on user preference
  },
  themes: appThemes,
  breakpoints,
});

// Extract types for autocomplete
type AppThemes = typeof appThemes;
type AppBreakpoints = typeof breakpoints;

// Override library types
declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

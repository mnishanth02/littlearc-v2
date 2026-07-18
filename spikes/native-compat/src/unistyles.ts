import { StyleSheet } from 'react-native-unistyles';

const breakpoints = {
  compact: 0,
  expanded: 768,
} as const;

const lightTheme = {
  colors: {
    background: '#F9F8F7',
    surface: '#FFFFFF',
    text: '#1D1A17',
    secondaryText: '#635E54',
    border: '#D5CFC4',
    action: '#302C27',
    actionText: '#FFFFFF',
    success: '#355938',
    warning: '#924300',
    danger: '#A92D26',
    pending: '#7F796E',
  },
  spacing: {
    small: 8,
    medium: 16,
    large: 24,
  },
} as const;

const darkTheme = {
  colors: {
    background: '#1D1A17',
    surface: '#302C27',
    text: '#F9F8F7',
    secondaryText: '#D5CFC4',
    border: '#635E54',
    action: '#F9F8F7',
    actionText: '#1D1A17',
    success: '#A3C7A5',
    warning: '#FFC84B',
    danger: '#F5B0AC',
    pending: '#B8B2A7',
  },
  spacing: lightTheme.spacing,
} as const;

const appThemes = {
  light: lightTheme,
  dark: darkTheme,
};

StyleSheet.configure({
  settings: {
    adaptiveThemes: true,
  },
  themes: appThemes,
  breakpoints,
});

type AppThemes = typeof appThemes;
type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}


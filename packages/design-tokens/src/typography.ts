import { Platform } from 'react-native';

const systemFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

// Using standard native fonts means we omit `fontFamily` or use `System` to let RN handle scaling best
export const typography = {
  screenTitle: {
    fontFamily: systemFont,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontFamily: systemFont,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
  },
  recordTitle: {
    fontFamily: systemFont,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  body: {
    fontFamily: systemFont,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  supportingText: {
    fontFamily: systemFont,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  metadata: {
    fontFamily: systemFont,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
    letterSpacing: 0.2,
  },
  label: {
    fontFamily: systemFont,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  buttonLabel: {
    fontFamily: systemFont,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  numericOrDate: {
    fontFamily: systemFont, // iOS will often map this well, optionally we can use fontVariant: ['tabular-nums'] in components
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500' as const,
  },
  statusText: {
    fontFamily: systemFont,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  emergencyValue: {
    fontFamily: systemFont,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700' as const,
  },
  errorText: {
    fontFamily: systemFont,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
};

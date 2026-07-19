export const spacing = {
  none: 0,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  "4xl": 48,
  "5xl": 64,
} as const;

export const radii = {
  control: 10,
  card: 16,
  sheet: 24,
  pill: 999,
} as const;

export const touchTargets = {
  minimum: 48,
  compact: 44,
} as const;

export const layout = {
  screenPadding: spacing.md,
  contentMaxWidth: 600,
  targetSeparation: spacing.xs,
} as const;

export const breakpoints = {
  phone: 0,
  tablet: 768,
} as const;

export const motion = {
  duration: {
    instant: 0,
    fast: 120,
    standard: 200,
    deliberate: 320,
  },
  reducedDuration: 0,
} as const;

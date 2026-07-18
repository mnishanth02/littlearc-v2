export const spacing = {
  // Base 4px scale
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
};

export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999, // Pills and circular icons
};

export const touchTargets = {
  min: 48, // 48dp minimum for accessible touch target
};

export const layout = {
  screenPadding: spacing[4],
  contentMaxWidth: 600, // Important for tablet/folding scenarios
};

export const breakpoints = {
  phone: 0,
  tablet: 768,
};

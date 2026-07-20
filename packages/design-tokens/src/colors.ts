export const palette = {
  amber: {
    50: "#fff7e0",
    200: "#f5d584",
    700: "#714b00",
    900: "#3d2a00",
  },
  blue: {
    50: "#edf4ff",
    200: "#b8d1f0",
    700: "#164f8c",
    900: "#102d4d",
  },
  sage: {
    50: "#f1f6f2",
    100: "#dbe8df",
    200: "#bed5c5",
    600: "#35684f",
    700: "#275440",
    900: "#173326",
  },
  terracotta: {
    50: "#fff1ee",
    200: "#efc0b8",
    700: "#97362f",
    800: "#7e2924",
    900: "#4c211e",
  },
  warmGray: {
    50: "#f7f4ec",
    100: "#efeae0",
    200: "#e1dbcf",
    300: "#c9c2b5",
    500: "#77766f",
    600: "#5d655a",
    700: "#394034",
    800: "#29332d",
    900: "#1f2a24",
    950: "#151c18",
  },
  black: "#000000",
  transparent: "transparent",
  white: "#ffffff",
} as const;

export const lightColors = {
  background: {
    primary: palette.warmGray[50],
    secondary: palette.warmGray[100],
    elevated: palette.white,
    inverse: palette.warmGray[900],
    disabled: palette.warmGray[200],
  },
  text: {
    primary: palette.warmGray[900],
    secondary: palette.warmGray[700],
    muted: palette.warmGray[600],
    inverse: palette.white,
    disabled: palette.warmGray[600],
    link: palette.blue[700],
  },
  border: {
    subtle: palette.warmGray[200],
    default: palette.warmGray[300],
    strong: palette.warmGray[600],
    focus: palette.blue[700],
    destructive: palette.terracotta[700],
  },
  action: {
    primary: "#1e5d4e",
    primaryPressed: "#16483c",
    secondary: palette.sage[100],
    secondaryPressed: palette.sage[200],
    disabled: palette.warmGray[200],
    destructive: palette.terracotta[700],
    destructivePressed: palette.terracotta[800],
  },
  status: {
    neutral: palette.warmGray[100],
    info: palette.blue[50],
    success: palette.sage[50],
    attention: palette.amber[50],
    warning: palette.amber[50],
    danger: palette.terracotta[50],
    offline: palette.warmGray[100],
  },
  record: {
    suggested: palette.amber[50],
    confirmed: palette.sage[50],
    verified: palette.blue[50],
    corrected: palette.sage[100],
    deleted: palette.warmGray[100],
  },
  provenance: {
    manual: palette.warmGray[100],
    imported: palette.blue[50],
    ocr: palette.amber[50],
    ai: palette.amber[50],
    caregiver: palette.sage[50],
    provider: palette.blue[50],
    government: palette.sage[100],
  },
  overlay: {
    scrim: "rgba(21, 28, 24, 0.56)",
    snapshotProtection: palette.warmGray[950],
    skeleton: palette.warmGray[200],
  },
} as const;

export type SemanticColors = {
  readonly [Group in keyof typeof lightColors]: {
    readonly [Role in keyof (typeof lightColors)[Group]]: string;
  };
};

export const darkColors = {
  background: {
    primary: palette.warmGray[950],
    secondary: palette.warmGray[900],
    elevated: palette.warmGray[800],
    inverse: palette.warmGray[50],
    disabled: "#343c36",
  },
  text: {
    primary: palette.warmGray[50],
    secondary: "#d8d2c6",
    muted: "#b8b5ae",
    inverse: palette.warmGray[950],
    disabled: "#a5a49e",
    link: "#9bc7ff",
  },
  border: {
    subtle: "#465048",
    default: "#5e685f",
    strong: "#b8b5ae",
    focus: "#9bc7ff",
    destructive: "#ffb4aa",
  },
  action: {
    primary: "#9fd6c3",
    primaryPressed: "#c3eadc",
    secondary: "#35493f",
    secondaryPressed: "#456052",
    disabled: "#343c36",
    destructive: "#ffb4aa",
    destructivePressed: "#ffd6d0",
  },
  status: {
    neutral: "#303a33",
    info: palette.blue[900],
    success: palette.sage[900],
    attention: palette.amber[900],
    warning: palette.amber[900],
    danger: palette.terracotta[900],
    offline: "#303a33",
  },
  record: {
    suggested: palette.amber[900],
    confirmed: palette.sage[900],
    verified: palette.blue[900],
    corrected: "#254a38",
    deleted: "#303a33",
  },
  provenance: {
    manual: "#303a33",
    imported: palette.blue[900],
    ocr: palette.amber[900],
    ai: palette.amber[900],
    caregiver: palette.sage[900],
    provider: palette.blue[900],
    government: "#254a38",
  },
  overlay: {
    scrim: "rgba(0, 0, 0, 0.72)",
    snapshotProtection: palette.black,
    skeleton: "#465048",
  },
} as const satisfies SemanticColors;

export const highContrastColors = {
  background: {
    primary: palette.white,
    secondary: palette.white,
    elevated: palette.white,
    inverse: palette.black,
    disabled: "#e0e0e0",
  },
  text: {
    primary: palette.black,
    secondary: palette.black,
    muted: palette.black,
    inverse: palette.white,
    disabled: "#555555",
    link: "#003f8f",
  },
  border: {
    subtle: palette.black,
    default: palette.black,
    strong: palette.black,
    focus: "#003f8f",
    destructive: "#8b0000",
  },
  action: {
    primary: palette.black,
    primaryPressed: "#222222",
    secondary: palette.white,
    secondaryPressed: "#e0e0e0",
    disabled: "#e0e0e0",
    destructive: "#8b0000",
    destructivePressed: "#650000",
  },
  status: {
    neutral: palette.white,
    info: palette.white,
    success: palette.white,
    attention: palette.white,
    warning: palette.white,
    danger: palette.white,
    offline: palette.white,
  },
  record: {
    suggested: palette.white,
    confirmed: palette.white,
    verified: palette.white,
    corrected: palette.white,
    deleted: palette.white,
  },
  provenance: {
    manual: palette.white,
    imported: palette.white,
    ocr: palette.white,
    ai: palette.white,
    caregiver: palette.white,
    provider: palette.white,
    government: palette.white,
  },
  overlay: {
    scrim: "rgba(0, 0, 0, 0.8)",
    snapshotProtection: palette.black,
    skeleton: "#cccccc",
  },
} as const satisfies SemanticColors;

export const semanticColorThemes = {
  light: lightColors,
  dark: darkColors,
  highContrast: highContrastColors,
} as const;

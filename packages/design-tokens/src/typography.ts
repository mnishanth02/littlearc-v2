type FontWeight = "400" | "500" | "600" | "700" | "800";

type TypographyToken = {
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontWeight: FontWeight;
  readonly letterSpacing?: number;
  readonly fontFamily?: "monospace";
};

export const typography = {
  display: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  screenTitle: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
  },
  bodyEmphasis: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  metadata: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
  },
  label: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
  },
  monospace: {
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
  },
} as const satisfies Record<string, TypographyToken>;

export type TypographyRole = keyof typeof typography;

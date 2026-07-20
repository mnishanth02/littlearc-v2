import { describe, expect, it } from "vitest";
import {
  darkColors,
  highContrastColors,
  lightColors,
  motion,
  semanticColorThemes,
  touchTargets,
  typography,
} from "./index.js";

const flattenKeys = (value: object, prefix = ""): string[] =>
  Object.entries(value).flatMap(([key, child]) => {
    const path = prefix.length > 0 ? `${prefix}.${key}` : key;
    return typeof child === "object" && child !== null ? flattenKeys(child, path) : [path];
  });

const channel = (hex: string, offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16);

const relativeLuminance = (hex: string): number => {
  const values = [channel(hex, 1), channel(hex, 3), channel(hex, 5)].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * (values[0] ?? 0) + 0.7152 * (values[1] ?? 0) + 0.0722 * (values[2] ?? 0);
};

const contrastRatio = (foreground: string, background: string): number => {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

describe("semantic design tokens", () => {
  it("keeps exactly the same semantic color roles in every theme", () => {
    const expected = flattenKeys(lightColors);

    expect(flattenKeys(darkColors)).toEqual(expected);
    expect(flattenKeys(highContrastColors)).toEqual(expected);
  });

  it.each(Object.entries(semanticColorThemes))(
    "%s meets WCAG AA for supported text, surface, and action pairs",
    (_name, colors) => {
      const pairs = [
        [colors.text.primary, colors.background.primary],
        [colors.text.primary, colors.background.elevated],
        [colors.text.secondary, colors.background.primary],
        [colors.text.muted, colors.background.primary],
        [colors.text.link, colors.background.primary],
        [colors.text.inverse, colors.background.inverse],
        [colors.text.inverse, colors.action.primary],
        [colors.text.primary, colors.action.secondary],
        [colors.text.inverse, colors.action.destructive],
      ] as const;

      for (const [foreground, background] of pairs) {
        expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it("uses accessible layout, type, and reduced-motion foundations", () => {
    expect(touchTargets.minimum).toBeGreaterThanOrEqual(48);
    expect(motion.reducedDuration).toBe(0);

    for (const token of Object.values(typography)) {
      expect(token.lineHeight).toBeGreaterThan(token.fontSize);
    }
  });
});

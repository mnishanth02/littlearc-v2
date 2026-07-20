import { describe, expect, it } from "vitest";
import { findSemanticStyleViolations } from "./policy.mjs";

describe("design-system source policy", () => {
  it("accepts semantic Unistyles source", () => {
    const source = `
      import { StyleSheet } from "react-native-unistyles";
      const styles = StyleSheet.create(theme => ({
        shell: { backgroundColor: theme.colors.background.primary }
      }));
    `;

    expect(findSemanticStyleViolations("screen.tsx", source)).toEqual([]);
  });

  it.each([
    ["literal hex", 'const style = { color: "#ffffff" };', "literal UI color"],
    ["literal rgb", 'const style = { color: "rgb(0, 0, 0)" };', "literal UI color"],
    [
      "React Native StyleSheet",
      'import { StyleSheet, View } from "react-native";',
      "import StyleSheet from react-native-unistyles",
    ],
    [
      "Unistyles v2",
      'import { createStyleSheet, useStyles } from "react-native-unistyles";',
      "removed Unistyles v2 API",
    ],
  ])("rejects %s", (_scenario, source, message) => {
    expect(findSemanticStyleViolations("screen.tsx", source).join("\n")).toContain(message);
  });
});

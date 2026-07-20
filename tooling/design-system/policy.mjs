const colorLiteralPattern = /(?:#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\s*\()/gi;
const legacyUnistylesPattern = /\b(?:createStyleSheet|useStyles)\b/g;
const nativeStyleSheetImportPattern =
  /import\s*\{[^}]*\bStyleSheet\b[^}]*\}\s*from\s*["']react-native["']/g;

export function findSemanticStyleViolations(file, source) {
  const violations = [];

  for (const match of source.matchAll(colorLiteralPattern)) {
    violations.push(`${file}: literal UI color ${match[0]} must be defined in design tokens`);
  }

  for (const match of source.matchAll(legacyUnistylesPattern)) {
    violations.push(`${file}: removed Unistyles v2 API ${match[0]} is forbidden`);
  }

  if (nativeStyleSheetImportPattern.test(source)) {
    violations.push(`${file}: import StyleSheet from react-native-unistyles`);
  }

  nativeStyleSheetImportPattern.lastIndex = 0;
  return violations;
}

export function validateEnvironmentEntries(relativePath, catalog, entries) {
  const violations = [];

  for (const name of entries.keys()) {
    if (!(name in catalog)) {
      violations.push(`${relativePath}: undocumented variable ${name}`);
    }
  }

  for (const [name, metadata] of Object.entries(catalog)) {
    if (!entries.has(name)) {
      violations.push(`${relativePath}: missing catalog variable ${name}`);
      continue;
    }

    if (metadata.secret && entries.get(name) !== "") {
      violations.push(`${relativePath}: secret or sensitive variable ${name} must remain blank`);
    }

    if (name.startsWith("EXPO_PUBLIC_") && metadata.classification !== "public") {
      violations.push(`${relativePath}: ${name} is client-visible and must be classified public`);
    }
  }

  return violations;
}

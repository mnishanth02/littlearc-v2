export type SensitiveCanary = {
  readonly label: string;
  readonly value: string;
};

export function assertNoSensitiveCanary(
  value: unknown,
  canaries: ReadonlyArray<SensitiveCanary>,
): void {
  const strings = collectStrings(value);

  for (const canary of canaries) {
    if (canary.value.length < 4) {
      throw new Error(`Sensitive canary ${canary.label} must contain at least four characters`);
    }

    if (strings.some((candidate) => candidate.includes(canary.value))) {
      throw new Error(`Sensitive canary detected in observability payload: ${canary.label}`);
    }
  }
}

function collectStrings(value: unknown, seen = new Set<object>()): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (value === null || typeof value !== "object" || seen.has(value)) {
    return [];
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStrings(entry, seen));
  }

  return Object.entries(value).flatMap(([key, entry]) => [key, ...collectStrings(entry, seen)]);
}
